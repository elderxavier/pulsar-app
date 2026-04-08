package com.pulsar.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pulsar.app.data.model.Post
import com.pulsar.app.data.repository.PostRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class PostViewModel : ViewModel() {
    private val repository = PostRepository()

    private val _posts = MutableStateFlow<List<Post>>(emptyList())
    val posts: StateFlow<List<Post>> = _posts

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _postSuccess = MutableStateFlow(false)
    val postSuccess: StateFlow<Boolean> = _postSuccess

    private var unsubscribe: (() -> Unit)? = null

    init {
        listenPosts()
    }

    private fun listenPosts() {
        unsubscribe = repository.listenActivePosts { posts ->
            _posts.value = posts
        }
    }

    fun createPost(content: String, latitude: Double, longitude: Double) {
        viewModelScope.launch {
            _loading.value = true
            _error.value = null
            val result = repository.createPost(content, latitude, longitude)
            if (result.isSuccess) {
                _postSuccess.value = true
            } else {
                _error.value = result.exceptionOrNull()?.message ?: "Erro ao criar post"
            }
            _loading.value = false
        }
    }

    fun resetPostSuccess() {
        _postSuccess.value = false
    }

    override fun onCleared() {
        super.onCleared()
        unsubscribe?.invoke()
    }
}
