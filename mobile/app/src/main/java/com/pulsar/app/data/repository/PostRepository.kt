package com.pulsar.app.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.GeoPoint
import com.pulsar.app.data.model.Post
import kotlinx.coroutines.tasks.await
import java.util.Date

class PostRepository {
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()

    suspend fun createPost(content: String, latitude: Double, longitude: Double): Result<String> {
        return try {
            val user = auth.currentUser ?: return Result.failure(Exception("Usuário não autenticado"))
            val now = Timestamp.now()
            val expiresAt = Timestamp(Date(now.toDate().time + 6 * 60 * 60 * 1000))

            val post = hashMapOf(
                "content" to content,
                "latitude" to latitude,
                "longitude" to longitude,
                "geopoint" to GeoPoint(latitude, longitude),
                "userId" to user.uid,
                "userName" to (user.displayName ?: user.email?.substringBefore("@") ?: "Anônimo"),
                "createdAt" to now,
                "expiresAt" to expiresAt,
            )

            val docRef = db.collection("posts").add(post).await()
            Result.success(docRef.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun listenActivePosts(onUpdate: (List<Post>) -> Unit): () -> Unit {
        val now = Timestamp.now()
        val listener = db.collection("posts")
            .whereGreaterThan("expiresAt", now)
            .orderBy("expiresAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, _ ->
                val posts = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Post::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                onUpdate(posts)
            }
        return { listener.remove() }
    }
}
