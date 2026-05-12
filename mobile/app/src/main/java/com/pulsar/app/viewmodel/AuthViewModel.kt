package com.pulsar.app.viewmodel

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Rect
import android.net.Uri
import android.util.Base64
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.UserProfileChangeRequest
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.pulsar.app.config.DevConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.io.ByteArrayOutputStream

class AuthViewModel : ViewModel() {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    private val _user = MutableStateFlow<FirebaseUser?>(auth.currentUser)
    val user: StateFlow<FirebaseUser?> = _user

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _myPhotoURL = MutableStateFlow("")
    val myPhotoURL: StateFlow<String> = _myPhotoURL

    private var profileListener: com.google.firebase.firestore.ListenerRegistration? = null

    init {
        auth.addAuthStateListener { fbAuth ->
            _user.value = fbAuth.currentUser
            profileListener?.remove()
            fbAuth.currentUser?.let { user ->
                profileListener = db.collection("users").document(user.uid)
                    .addSnapshotListener { snap, _ ->
                        _myPhotoURL.value = snap?.getString("photoURL") ?: ""
                    }
            } ?: run { _myPhotoURL.value = "" }
        }
        if (DevConfig.BYPASS_AUTH && auth.currentUser == null) bypassLogin()
    }

    private fun bypassLogin() {
        viewModelScope.launch {
            _loading.value = true
            try { auth.signInAnonymously().await() }
            catch (e: Exception) { _error.value = "Bypass falhou: ${e.message}" }
            finally { _loading.value = false }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _loading.value = true; _error.value = null
            try { auth.signInWithEmailAndPassword(email, password).await() }
            catch (e: Exception) { _error.value = mapLoginError(e) }
            finally { _loading.value = false }
        }
    }

    fun register(email: String, password: String) {
        viewModelScope.launch {
            _loading.value = true; _error.value = null
            try { auth.createUserWithEmailAndPassword(email, password).await() }
            catch (e: Exception) { _error.value = mapRegisterError(e) }
            finally { _loading.value = false }
        }
    }

    fun signInWithGoogle(idToken: String) {
        viewModelScope.launch {
            _loading.value = true; _error.value = null
            try {
                val credential = GoogleAuthProvider.getCredential(idToken, null)
                auth.signInWithCredential(credential).await()
            } catch (e: Exception) {
                _error.value = "Erro no login com Google: ${e.message}"
            } finally { _loading.value = false }
        }
    }

    fun updateDisplayName(name: String, onDone: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            _loading.value = true
            try {
                auth.currentUser?.updateProfile(
                    UserProfileChangeRequest.Builder().setDisplayName(name).build()
                )?.await()
                auth.currentUser?.uid?.let {
                    db.collection("users").document(it).set(mapOf("displayName" to name), SetOptions.merge()).await()
                }
                _user.value = auth.currentUser
                onDone(true)
            } catch (e: Exception) {
                _error.value = "Erro ao atualizar perfil: ${e.message}"
                onDone(false)
            } finally { _loading.value = false }
        }
    }

    /** Lê a imagem do URI, redimensiona para 256x256 JPEG, salva como base64 data URI no Firestore. */
    fun uploadAvatar(context: Context, uri: Uri, onResult: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            _loading.value = true; _error.value = null
            try {
                val uid = auth.currentUser?.uid ?: throw Exception("Não autenticado")
                val dataUri = resizeToDataUri(context, uri, 256, 75)
                if (dataUri.length > 700_000) throw Exception("Imagem muito grande mesmo após compressão")
                db.collection("users").document(uid)
                    .set(mapOf("photoURL" to dataUri), SetOptions.merge()).await()
                onResult(true)
            } catch (e: Exception) {
                _error.value = "Erro no upload: ${e.message}"
                onResult(false)
            } finally { _loading.value = false }
        }
    }

    private fun resizeToDataUri(context: Context, uri: Uri, size: Int, quality: Int): String {
        val input = context.contentResolver.openInputStream(uri) ?: throw Exception("Falha ao abrir imagem")
        val original = input.use { BitmapFactory.decodeStream(it) } ?: throw Exception("Imagem inválida")
        // cover-crop centralizado para size x size
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        val r = maxOf(size.toFloat() / original.width, size.toFloat() / original.height)
        val w = (original.width * r).toInt()
        val h = (original.height * r).toInt()
        val dst = Rect((size - w) / 2, (size - h) / 2, (size - w) / 2 + w, (size - h) / 2 + h)
        canvas.drawBitmap(original, null, dst, null)
        val baos = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.JPEG, quality, baos)
        original.recycle(); bmp.recycle()
        val base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
        return "data:image/jpeg;base64,$base64"
    }

    private fun mapLoginError(e: Exception): String = when (e) {
        is FirebaseAuthInvalidCredentialsException,
        is FirebaseAuthInvalidUserException -> "Email ou senha incorretos."
        else -> "Erro ao fazer login. Tente novamente."
    }

    private fun mapRegisterError(e: Exception): String = when (e) {
        is FirebaseAuthWeakPasswordException -> "Senha muito fraca. Use pelo menos 6 caracteres."
        is FirebaseAuthInvalidCredentialsException -> "Email inválido."
        is FirebaseAuthUserCollisionException -> "Este email já está em uso. Tente entrar."
        else -> "Erro ao criar conta. Tente novamente."
    }

    fun logout() { auth.signOut() }
    fun clearError() { _error.value = null }
    override fun onCleared() { super.onCleared(); profileListener?.remove() }
}
