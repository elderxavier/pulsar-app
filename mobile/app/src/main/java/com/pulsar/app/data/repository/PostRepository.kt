package com.pulsar.app.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.GeoPoint
import com.pulsar.app.data.model.Post
import kotlinx.coroutines.tasks.await
import java.util.Date
import java.util.Locale

class PostRepository {
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()

    suspend fun createPost(
        title: String,
        content: String,
        latitude: Double,
        longitude: Double,
        startsAt: Timestamp,
        expiresAt: Timestamp,
        imageUrl: String = "",
        videoUrl: String = "",
    ): Result<String> {
        return try {
            val user = auth.currentUser ?: return Result.failure(Exception("Usuário não autenticado"))
            val now = Timestamp.now()
            // Preserva a duração escolhida pelo usuário, mas ancora ao createdAt real
            val durationMs = expiresAt.toDate().time - startsAt.toDate().time
            val anchoredExpires = Timestamp(Date(now.toDate().time + durationMs.coerceAtLeast(3_600_000)))

            val post = hashMapOf(
                "title" to title,
                "content" to content,
                "latitude" to latitude,
                "longitude" to longitude,
                "geopoint" to GeoPoint(latitude, longitude),
                "userId" to user.uid,
                "userName" to (user.displayName ?: user.email?.substringBefore("@") ?: "Anônimo"),
                "createdAt" to now,
                "startsAt" to now,
                "expiresAt" to anchoredExpires,
                "imageUrl" to imageUrl,
                "videoUrl" to videoUrl,
            )

            val docRef = db.collection("posts").add(post).await()
            Result.success(docRef.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun listenActivePosts(onUpdate: (List<Post>) -> Unit): () -> Unit {
        val now = Timestamp.now()

        // Query com filtro de expiração (requer rule: allow read: if request.auth != null)
        val listener = db.collection("posts")
            .whereGreaterThan("expiresAt", now)
            .orderBy("expiresAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    android.util.Log.e("PostRepository", "listenActivePosts filtrada falhou (${error.code}): ${error.message}")
                    // Fallback: busca sem filtro e filtra no cliente
                    // Isso funciona com a regra antiga: allow read: if request.time < resource.data.expiresAt
                    listenAllPostsWithClientFilter(now, onUpdate)
                    return@addSnapshotListener
                }
                val posts = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Post::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                android.util.Log.d("PostRepository", "listenActivePosts: ${posts.size} posts")
                onUpdate(posts)
            }
        return { listener.remove() }
    }

    suspend fun deletePost(postId: String): Result<Unit> {
        return try {
            db.collection("posts").document(postId).delete().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updatePost(postId: String, content: String): Result<Unit> {
        return try {
            db.collection("posts").document(postId)
                .update("content", content).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun listenAllPostsWithClientFilter(since: Timestamp, onUpdate: (List<Post>) -> Unit) {
        db.collection("posts")
            .orderBy("expiresAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .limit(200)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    android.util.Log.e("PostRepository", "Fallback também falhou: ${error.message}")
                    return@addSnapshotListener
                }
                val now = Timestamp.now()
                val posts = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Post::class.java)?.copy(id = doc.id)
                }?.filter { it.expiresAt.compareTo(now) > 0 } ?: emptyList()
                android.util.Log.d("PostRepository", "Fallback: ${posts.size} posts ativos")
                onUpdate(posts)
            }
    }
}
