package br.com.appsx.pulsar.data.repository

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageReference
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.util.UUID

/**
 * Upload de mídia (imagem/vídeo) para Firebase Storage.
 *
 * - Imagens são redimensionadas (max 1920 px no maior lado) e recomprimidas em JPEG q=85
 *   antes do upload — reduz quota e latência em ~10x para fotos de câmera (12 MP → ~300 KB).
 * - Vídeos sobem como vieram (raw); cliente já valida tamanho.
 * - Path: posts/{uid}/{uuid}.{ext}
 * - URL final (https) é obtida via `downloadUrl`.
 */
class MediaRepository(private val context: Context) {

    private val storage = FirebaseStorage.getInstance()
    private val auth    = FirebaseAuth.getInstance()

    companion object {
        private const val MAX_IMAGE_DIMENSION = 1920
        private const val JPEG_QUALITY        = 85
        private const val MAX_BYTES           = 10L * 1024 * 1024   // 10 MB
    }

    suspend fun uploadImage(uri: Uri, onProgress: ((Float) -> Unit)? = null): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val uid = auth.currentUser?.uid ?: error("Usuário não autenticado")
                val bytes = compressImage(uri)
                require(bytes.size.toLong() <= MAX_BYTES) { "Imagem excede 10MB após compressão" }
                val ref = storage.reference.child("posts/$uid/${UUID.randomUUID()}.jpg")
                uploadBytes(ref, bytes, "image/jpeg", onProgress)
            }
        }

    suspend fun uploadVideo(uri: Uri, onProgress: ((Float) -> Unit)? = null): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val uid = auth.currentUser?.uid ?: error("Usuário não autenticado")
                val mime = context.contentResolver.getType(uri) ?: "video/mp4"
                val ext  = mime.substringAfter('/', "mp4")
                val size = context.contentResolver.openFileDescriptor(uri, "r")?.use { it.statSize } ?: 0L
                require(size in 1..MAX_BYTES) { "Vídeo vazio ou maior que 10MB" }

                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: error("Não foi possível ler o vídeo")
                val ref = storage.reference.child("posts/$uid/${UUID.randomUUID()}.$ext")
                uploadBytes(ref, bytes, mime, onProgress)
            }
        }

    /**
     * Apaga uma mídia do Storage a partir da URL HTTPS pública.
     * Erros são silenciosos — não bloqueiam o fluxo principal.
     */
    suspend fun deleteByUrl(httpsUrl: String) {
        if (!httpsUrl.startsWith("https://")) return
        withContext(Dispatchers.IO) {
            runCatching { storage.getReferenceFromUrl(httpsUrl).delete().await() }
        }
    }

    // ------------------ helpers ------------------

    private suspend fun uploadBytes(
        ref: StorageReference,
        bytes: ByteArray,
        mime: String,
        onProgress: ((Float) -> Unit)?,
    ): String {
        val metadata = com.google.firebase.storage.StorageMetadata.Builder()
            .setContentType(mime)
            .build()
        val task = ref.putBytes(bytes, metadata)
        if (onProgress != null) {
            task.addOnProgressListener { snap ->
                val pct = if (snap.totalByteCount > 0) snap.bytesTransferred.toFloat() / snap.totalByteCount else 0f
                onProgress(pct.coerceIn(0f, 1f))
            }
        }
        task.await()
        return ref.downloadUrl.await().toString()
    }

    /**
     * Carrega a imagem da Uri respeitando EXIF orientation, redimensiona se necessário
     * e comprime em JPEG. Faz a leitura em 2 passos para evitar OOM em fotos grandes.
     */
    private fun compressImage(uri: Uri): ByteArray {
        val cr = context.contentResolver

        // 1) Lê apenas bounds para calcular inSampleSize sem alocar a bitmap inteira.
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        cr.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            ?: error("Imagem inválida")

        val sampleSize = calcInSampleSize(bounds.outWidth, bounds.outHeight, MAX_IMAGE_DIMENSION)
        val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sampleSize }

        val decoded = cr.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, decodeOpts)
        } ?: error("Falha ao decodificar imagem")

        // 2) Aplica rotação do EXIF (alguns devices salvam a foto rotacionada via metadado).
        val oriented = applyExifRotation(uri, decoded)

        // 3) Redimensiona o lado maior para o limite exato.
        val resized  = resizeIfNeeded(oriented, MAX_IMAGE_DIMENSION)

        // 4) Comprime em JPEG.
        val out = ByteArrayOutputStream()
        resized.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
        if (resized !== oriented) resized.recycle()
        if (oriented !== decoded) oriented.recycle()
        decoded.recycle()
        return out.toByteArray()
    }

    private fun calcInSampleSize(width: Int, height: Int, target: Int): Int {
        var sample = 1
        var half = maxOf(width, height) / 2
        while (half / sample >= target) sample *= 2
        return sample.coerceAtLeast(1)
    }

    private fun resizeIfNeeded(src: Bitmap, target: Int): Bitmap {
        val maxSide = maxOf(src.width, src.height)
        if (maxSide <= target) return src
        val ratio = target.toFloat() / maxSide
        val w = (src.width  * ratio).toInt()
        val h = (src.height * ratio).toInt()
        return Bitmap.createScaledBitmap(src, w, h, true)
    }

    private fun applyExifRotation(uri: Uri, bmp: Bitmap): Bitmap {
        val degrees = runCatching {
            context.contentResolver.openInputStream(uri)?.use { stream ->
                val exif = ExifInterface(stream)
                when (exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                    ExifInterface.ORIENTATION_ROTATE_90  -> 90f
                    ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                    ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                    else -> 0f
                }
            } ?: 0f
        }.getOrDefault(0f)

        if (degrees == 0f) return bmp
        val matrix = Matrix().apply { postRotate(degrees) }
        return Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, matrix, true)
    }
}
