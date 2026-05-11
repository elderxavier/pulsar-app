package com.pulsar.app.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.GeoPoint

data class Post(
    val id: String = "",
    val title: String = "",
    val content: String = "",
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    val geopoint: GeoPoint = GeoPoint(0.0, 0.0),
    val userId: String = "",
    val userName: String = "",
    val createdAt: Timestamp = Timestamp.now(),
    val startsAt: Timestamp = Timestamp.now(),
    val expiresAt: Timestamp = Timestamp.now(),
    val imageUrl: String = "",
    val videoUrl: String = "",
)
