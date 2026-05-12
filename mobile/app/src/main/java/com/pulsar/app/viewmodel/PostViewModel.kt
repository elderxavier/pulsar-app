package com.pulsar.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.pulsar.app.data.model.Comment
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

    fun createPost(
        title: String,
        content: String,
        latitude: Double,
        longitude: Double,
        startsAt: Timestamp,
        expiresAt: Timestamp,
        imageUrl: String = "",
        videoUrl: String = "",
    ) {
        viewModelScope.launch {
            _loading.value = true
            _error.value = null
            val result = repository.createPost(title, content, latitude, longitude, startsAt, expiresAt, imageUrl, videoUrl)
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

    fun deletePost(postId: String) {
        viewModelScope.launch {
            val result = repository.deletePost(postId)
            if (result.isFailure) {
                _error.value = "Erro ao excluir: ${result.exceptionOrNull()?.message}"
            }
        }
    }

    fun updatePost(postId: String, content: String) {
        viewModelScope.launch {
            _loading.value = true
            val result = repository.updatePost(postId, content)
            if (result.isSuccess) {
                _postSuccess.value = true
            } else {
                _error.value = "Erro ao editar: ${result.exceptionOrNull()?.message}"
            }
            _loading.value = false
        }
    }

    fun toggleLike(postId: String) {
        viewModelScope.launch {
            val result = repository.toggleLike(postId)
            if (result.isFailure) {
                _error.value = "Erro ao curtir: ${result.exceptionOrNull()?.message}"
            }
        }
    }

    private val _comments = MutableStateFlow<Map<String, List<Comment>>>(emptyMap())
    val comments: StateFlow<Map<String, List<Comment>>> = _comments
    private val commentUnsubs = mutableMapOf<String, () -> Unit>()

    fun listenComments(postId: String) {
        if (commentUnsubs.containsKey(postId)) return
        commentUnsubs[postId] = repository.listenComments(postId) { list ->
            _comments.value = _comments.value + (postId to list)
        }
    }

    fun stopListeningComments(postId: String) {
        commentUnsubs.remove(postId)?.invoke()
    }

    fun addComment(postId: String, content: String) {
        viewModelScope.launch {
            val result = repository.addComment(postId, content)
            if (result.isFailure) {
                _error.value = "Erro ao comentar: ${result.exceptionOrNull()?.message}"
            }
        }
    }

    fun updateComment(postId: String, commentId: String, content: String) {
        viewModelScope.launch {
            val result = repository.updateComment(postId, commentId, content)
            if (result.isFailure) {
                _error.value = "Erro ao editar comentário: ${result.exceptionOrNull()?.message}"
            }
        }
    }

    fun deleteComment(postId: String, commentId: String) {
        viewModelScope.launch {
            val result = repository.deleteComment(postId, commentId)
            if (result.isFailure) {
                _error.value = "Erro ao excluir comentário: ${result.exceptionOrNull()?.message}"
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        unsubscribe?.invoke()
    }
}
