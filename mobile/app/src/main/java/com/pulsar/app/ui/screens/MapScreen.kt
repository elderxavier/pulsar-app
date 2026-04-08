package com.pulsar.app.ui.screens

import android.Manifest
import android.annotation.SuppressLint
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.rememberPermissionState
import com.pulsar.app.data.model.Post
import com.pulsar.app.ui.theme.PulsarBackground
import com.pulsar.app.ui.theme.PulsarCyan
import com.pulsar.app.ui.theme.PulsarSurface
import com.pulsar.app.viewmodel.AuthViewModel
import com.pulsar.app.viewmodel.PostViewModel
import java.util.Date

@SuppressLint("MissingPermission")
@Composable
fun MapScreen(
    authViewModel: AuthViewModel,
    postViewModel: PostViewModel,
    onCreatePost: () -> Unit,
) {
    val posts by postViewModel.posts.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(PulsarBackground)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Top Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF111111))
                    .padding(horizontal = 20.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(PulsarCyan, CircleShape)
                    )
                    Text(
                        text = "PULSAR",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = PulsarCyan,
                        letterSpacing = 4.sp
                    )
                }
                IconButton(onClick = { authViewModel.logout() }) {
                    Icon(Icons.Default.ExitToApp, contentDescription = "Sair", tint = Color.Gray)
                }
            }

            // Posts count
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Radar ao vivo",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = PulsarCyan.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = "${posts.size} ativos",
                        color = PulsarCyan,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }

            // Posts list
            if (posts.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("📡", fontSize = 48.sp)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Nenhum post nas proximidades", color = Color.Gray, fontSize = 14.sp)
                        Text("Seja o primeiro a pulsar!", color = Color(0xFF555555), fontSize = 12.sp)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(posts, key = { it.id }) { post ->
                        PostCard(post = post)
                    }
                    item { Spacer(modifier = Modifier.height(80.dp)) }
                }
            }
        }

        // FAB
        FloatingActionButton(
            onClick = onCreatePost,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(24.dp),
            containerColor = PulsarCyan,
            contentColor = PulsarBackground,
            shape = CircleShape
        ) {
            Icon(Icons.Default.Add, contentDescription = "Novo post", modifier = Modifier.size(28.dp))
        }
    }
}

@Composable
fun PostCard(post: Post) {
    val timeLeft = remember(post.expiresAt) {
        val diff = post.expiresAt.toDate().time - Date().time
        if (diff <= 0) "Expirado"
        else {
            val h = diff / 3600000
            val m = (diff % 3600000) / 60000
            if (h > 0) "${h}h ${m}m" else "${m}m"
        }
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = PulsarSurface,
        tonalElevation = 2.dp
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Surface(
                        shape = CircleShape,
                        color = PulsarCyan.copy(alpha = 0.15f),
                        modifier = Modifier.size(32.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = post.userName.firstOrNull()?.uppercaseChar()?.toString() ?: "?",
                                color = PulsarCyan,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Text(post.userName, color = Color(0xFFCCCCCC), fontSize = 13.sp, fontWeight = FontWeight.Medium)
                }
                Text(
                    text = timeLeft,
                    color = PulsarCyan,
                    fontSize = 11.sp,
                )
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = post.content,
                color = Color.White,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                maxLines = 4,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "📍 ${"%.4f".format(post.latitude)}, ${"%.4f".format(post.longitude)}",
                color = Color(0xFF666666),
                fontSize = 11.sp
            )
        }
    }
}
