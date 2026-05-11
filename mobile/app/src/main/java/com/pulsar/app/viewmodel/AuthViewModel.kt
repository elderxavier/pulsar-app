package com.pulsar.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.pulsar.app.config.DevConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class AuthViewModel : ViewModel() {
    private val auth = FirebaseAuth.getInstance()

    private val _user = MutableStateFlow<FirebaseUser?>(auth.currentUser)
    val user: StateFlow<FirebaseUser?> = _user

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    init {
        auth.addAuthStateListener { _user.value = it.currentUser }
        if (DevConfig.BYPASS_AUTH && auth.currentUser == null) {
            bypassLogin()
        }
    }

    private fun bypassLogin() {
        viewModelScope.launch {
            _loading.value = true
            try {
                auth.signInAnonymously().await()
            } catch (e: Exception) {
                _error.value = "Bypass falhou: ${e.message}. Habilite Anonymous Auth no Firebase."
            } finally {
                _loading.value = false
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _loading.value = true
            _error.value = null
            try {
                auth.signInWithEmailAndPassword(email, password).await()
            } catch (e: Exception) {
                _error.value = mapLoginError(e)
            } finally {
                _loading.value = false
            }
        }
    }

    fun register(email: String, password: String) {
        viewModelScope.launch {
            _loading.value = true
            _error.value = null
            try {
                auth.createUserWithEmailAndPassword(email, password).await()
            } catch (e: Exception) {
                _error.value = mapRegisterError(e)
            } finally {
                _loading.value = false
            }
        }
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

    fun signInWithGoogle(idToken: String) {
        viewModelScope.launch {
            _loading.value = true
            _error.value = null
            try {
                val credential = GoogleAuthProvider.getCredential(idToken, null)
                auth.signInWithCredential(credential).await()
            } catch (e: Exception) {
                _error.value = "Erro no login com Google: ${e.message}"
            } finally {
                _loading.value = false
            }
        }
    }

    fun logout() {
        auth.signOut()
    }

    fun clearError() {
        _error.value = null
    }
}
