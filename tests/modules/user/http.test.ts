import { afterAll, describe, expect, it, spyOn } from "bun:test"
import { rm } from "node:fs/promises"

import { app } from "../../../src/app"
import { setStorageForTests } from "../../../src/lib/storage"
import { userRepository } from "../../../src/modules/user/repository"
import { origin, request, signUp } from "../../helpers/http"

describe("module.user http", () => {
	const stamp = Date.now()

	afterAll(async () => {
		setStorageForTests(undefined)
		const dir = process.env.STORAGE_LOCAL_DIR
		if (dir) await rm(dir, { recursive: true, force: true })
	})

	it("lets a member patch own profile and blocks listing users", async () => {
		const member = await signUp("Member", `member-${stamp}@example.com`)

		const me = await request("/api/users/me", {
			headers: { authorization: `Bearer ${member.token}` },
		})
		expect(me.response.status).toBe(200)
		expect(me.body.code).toBe("OK")
		expect(me.body.data.email).toBe(member.user.email)

		const patched = await request("/api/users/me", {
			method: "PATCH",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${member.token}`,
			},
			body: JSON.stringify({ name: "Member Updated" }),
		})
		expect(patched.response.status).toBe(200)
		expect(patched.body.data.name).toBe("Member Updated")

		const listed = await request("/api/users", {
			headers: { authorization: `Bearer ${member.token}` },
		})
		expect(listed.response.status).toBe(403)
		expect(listed.body.code).toBe("FORBIDDEN")

		const access = await request("/api/users/me/access", {
			headers: { authorization: `Bearer ${member.token}` },
		})
		expect(access.response.status).toBe(200)
		expect(access.body.data.role).toBe("user")
		expect(access.body.data.permissions.user).toBeUndefined()
	})

	it("lets an admin list users, set roles, and keeps the last admin", async () => {
		const admin = await signUp("AdminA", `admin-a-${stamp}@example.com`)
		const other = await signUp("AdminB", `admin-b-${stamp}@example.com`)

		await userRepository.update(admin.user.id, { role: "admin" })
		await userRepository.update(other.user.id, { role: "admin" })

		const visible = await request("/api/users", {
			headers: { authorization: `Bearer ${admin.token}` },
		})
		expect(visible.response.status).toBe(200)
		expect(visible.body.code).toBe("OK")
		expect(visible.body.data.meta.total).toBeGreaterThan(0)
		expect(visible.body.data.meta.page).toBe(1)
		expect(visible.body.data.meta.pageSize).toBe(20)
		expect(Array.isArray(visible.body.data.items)).toBe(true)

		const changed = await request(`/api/users/${other.user.id}/role`, {
			method: "PATCH",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${admin.token}`,
			},
			body: JSON.stringify({ role: "user" }),
		})
		expect(changed.response.status).toBe(200)
		expect(changed.body.data.role).toBe("user")

		const hidden = await request("/api/users", {
			headers: { authorization: `Bearer ${other.token}` },
		})
		expect(hidden.response.status).toBe(403)

		const lastAdmin = await request(`/api/users/${admin.user.id}/role`, {
			method: "PATCH",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${admin.token}`,
			},
			body: JSON.stringify({ role: "user" }),
		})
		expect(lastAdmin.response.status).toBe(409)
		expect(lastAdmin.body.code).toBe("CONFLICT")
	})

	it("uploads an avatar via shared storage and sets user.image", async () => {
		const member = await signUp("Avatar", `avatar-${stamp}@example.com`)
		const png = new Uint8Array([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
			0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90,
			0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8,
			0xff, 0xff, 0x3f, 0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00,
			0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
		])
		const form = new FormData()
		form.set("file", new File([png], "me.png", { type: "image/png" }))

		const uploaded = await request("/api/users/me/avatar", {
			method: "POST",
			headers: { authorization: `Bearer ${member.token}` },
			body: form,
		})
		expect(uploaded.response.status).toBe(200)
		expect(uploaded.body.data.image).toContain("/uploads/")
		expect(uploaded.body.data.image).toContain(`avatars/${member.user.id}`)

		const imagePath = new URL(uploaded.body.data.image as string).pathname
		const served = await app.handle(new Request(`${origin}${imagePath}`))
		expect(served.status).toBe(200)
		expect(served.headers.get("content-type")).toContain("image/png")
	})

	it("lets an admin create a user with autoConfirm", async () => {
		const admin = await signUp("Creator", `creator-${stamp}@example.com`)
		await userRepository.update(admin.user.id, { role: "admin" })

		const created = await request("/api/users", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${admin.token}`,
			},
			body: JSON.stringify({
				name: "Created",
				email: `created-${stamp}@example.com`,
				password: "CreatePass1!",
				role: "user",
				autoConfirm: true,
			}),
		})
		expect(created.response.status).toBe(200)
		expect(created.body.data.email).toBe(`created-${stamp}@example.com`)
		expect(created.body.data.role).toBe("user")
		expect(created.body.data.emailVerified).toBe(true)

		const unverified = await request("/api/users", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${admin.token}`,
			},
			body: JSON.stringify({
				email: `unverified-${stamp}@example.com`,
				password: "CreatePass1!",
				autoConfirm: false,
			}),
		})
		expect(unverified.response.status).toBe(200)
		expect(unverified.body.data.emailVerified).toBe(false)

		const asMember = await signUp("Nope", `nope-${stamp}@example.com`)
		const forbidden = await request("/api/users", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${asMember.token}`,
			},
			body: JSON.stringify({
				name: "X",
				email: `x-${stamp}@example.com`,
				password: "CreatePass1!",
			}),
		})
		expect(forbidden.response.status).toBe(403)
	})

	it("lets an admin invite a user without password and sends invite email", async () => {
		const admin = await signUp("Inviter", `inviter-${stamp}@example.com`)
		await userRepository.update(admin.user.id, { role: "admin" })

		const log = spyOn(console, "log").mockImplementation(() => {})
		try {
			const invited = await request("/api/users/invite", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${admin.token}`,
				},
				body: JSON.stringify({
					email: `invitee-${stamp}@example.com`,
					name: "Invitee",
					role: "user",
				}),
			})
			expect(invited.response.status).toBe(200)
			expect(invited.body.data.email).toBe(`invitee-${stamp}@example.com`)
			expect(invited.body.data.role).toBe("user")
			expect(invited.body.data.emailVerified).toBe(false)

			const inviteMail = log.mock.calls
				.filter((call) => call[0] === "[email:mock]")
				.map((call) => call[1] as Record<string, unknown>)
				.find((payload) => payload.to === `invitee-${stamp}@example.com`)
			expect(inviteMail).toBeDefined()
			expect(String(inviteMail?.subject)).toContain("invited")
			// Prefer `text` — mock `html` is truncated to 500 chars and may omit the path.
			expect(String(inviteMail?.text ?? "")).toContain("reset-password")

			const duplicate = await request("/api/users/invite", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${admin.token}`,
				},
				body: JSON.stringify({
					email: `invitee-${stamp}@example.com`,
				}),
			})
			expect(duplicate.response.status).toBe(409)
			expect(duplicate.body.code).toBe("CONFLICT")

			const asMember = await signUp("MemberInvite", `member-invite-${stamp}@example.com`)
			const forbidden = await request("/api/users/invite", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${asMember.token}`,
				},
				body: JSON.stringify({
					email: `blocked-invite-${stamp}@example.com`,
				}),
			})
			expect(forbidden.response.status).toBe(403)
		} finally {
			log.mockRestore()
		}
	})

	it("lets an admin ban, unban, and delete a user; blocks self-ban and self-delete", async () => {
		const admin = await signUp("BanAdmin", `ban-admin-${stamp}@example.com`)
		const peer = await signUp("BanPeer", `ban-peer-${stamp}@example.com`)
		const target = await signUp("BanTarget", `ban-target-${stamp}@example.com`)
		await userRepository.update(admin.user.id, { role: "admin" })
		await userRepository.update(peer.user.id, { role: "admin" })

		const selfBan = await request(`/api/users/${admin.user.id}/ban`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${admin.token}`,
			},
			body: JSON.stringify({ reason: "nope" }),
		})
		expect(selfBan.response.status).toBe(409)
		expect(selfBan.body.code).toBe("CONFLICT")

		const banned = await request(`/api/users/${target.user.id}/ban`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${admin.token}`,
			},
			body: JSON.stringify({ reason: "abuse" }),
		})
		expect(banned.response.status).toBe(200)
		expect(banned.body.data.banned).toBe(true)

		const unbanned = await request(`/api/users/${target.user.id}/unban`, {
			method: "POST",
			headers: { authorization: `Bearer ${admin.token}` },
		})
		expect(unbanned.response.status).toBe(200)
		expect(unbanned.body.data.banned).toBe(false)

		const selfDelete = await request(`/api/users/${admin.user.id}`, {
			method: "DELETE",
			headers: { authorization: `Bearer ${admin.token}` },
		})
		expect(selfDelete.response.status).toBe(409)
		expect(selfDelete.body.code).toBe("CONFLICT")

		const deleted = await request(`/api/users/${target.user.id}`, {
			method: "DELETE",
			headers: { authorization: `Bearer ${admin.token}` },
		})
		expect(deleted.response.status).toBe(200)
		expect(deleted.body.data.deleted).toBe(true)

		// Two admins remain — deleting a peer admin is allowed (last-admin demote covered in set-role test).
		const deletedPeer = await request(`/api/users/${peer.user.id}`, {
			method: "DELETE",
			headers: { authorization: `Bearer ${admin.token}` },
		})
		expect(deletedPeer.response.status).toBe(200)
		expect(deletedPeer.body.data.deleted).toBe(true)
	})
})
