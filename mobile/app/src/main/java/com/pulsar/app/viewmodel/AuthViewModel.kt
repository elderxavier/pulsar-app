package com.pulsar.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
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
                _error.value = e.message ?: "Erro ao fazer login"
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
                _error.value = e.message ?: "Erro ao criar conta"
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
