import type { MessageKey } from "./en"

/** Indonesian message catalog — same keys as `en`. */
export const id: Record<MessageKey, string> = {
	"locales.en": "English",
	"locales.id": "Bahasa Indonesia",

	"common.success": "Berhasil",

	"errors.unauthorized": "Autentikasi diperlukan",
	"errors.forbidden": "Anda tidak memiliki izin untuk melakukan tindakan ini",
	"errors.notFound": "Tidak ditemukan",
	"errors.validation": "Validasi permintaan gagal",
	"errors.parse": "Body permintaan tidak dapat diparse",
	"errors.rateLimited": "Terlalu banyak permintaan",
	"errors.banned": "Akun ini dibanned",
	"errors.internal": "Kesalahan server internal",
	"errors.routeNotFound": "Rute tidak ditemukan",

	"errors.userNotFound": "Pengguna tidak ditemukan",
	"errors.nameEmpty": "Nama tidak boleh kosong",
	"errors.cannotListUsers": "Anda tidak dapat melihat daftar pengguna",
	"errors.cannotCreateUsers": "Anda tidak dapat membuat pengguna",
	"errors.unknownRole": "Peran tidak dikenal",
	"errors.couldNotCreateUser": "Tidak dapat membuat pengguna",
	"errors.cannotChangeRoles": "Anda tidak dapat mengubah peran",
	"errors.adminMustRemain": "Setidaknya satu administrator harus tetap ada",
	"errors.cannotBanUsers": "Anda tidak dapat mem-ban pengguna",
	"errors.cannotBanSelf": "Anda tidak dapat mem-ban diri sendiri",
	"errors.cannotUnbanUsers": "Anda tidak dapat meng-unban pengguna",
	"errors.cannotDeleteUsers": "Anda tidak dapat menghapus pengguna",
	"errors.cannotDeleteSelf": "Anda tidak dapat menghapus diri sendiri",
	"errors.cannotViewUser": "Anda tidak dapat melihat pengguna ini",
	"errors.ownDataOnly": "Anda hanya dapat mengakses data sendiri",
	"errors.fileNotFound": "Berkas tidak ditemukan",
	"errors.fileInvalidKey": "Kunci berkas tidak valid",
	"errors.fileUploadFailed": "Unggah berkas gagal",
	"errors.avatarInvalidType": "Avatar harus berupa gambar (png, jpeg, gif, atau webp)",
	"errors.avatarUploadFailed": "Unggah avatar gagal",

	"health.ok": "ok",
}
