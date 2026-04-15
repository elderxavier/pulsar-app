package com.pulsar.app.ui.screens

import android.annotation.SuppressLint
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.mylocation.GpsMyLocationProvider
import org.osmdroid.views.overlay.mylocation.MyLocationNewOverlay
import com.pulsar.app.data.model.Post
import com.pulsar.app.ui.theme.PulsarBackground
import com.pulsar.app.ui.theme.PulsarCyan
import com.pulsar.app.viewmodel.AuthViewModel
import com.pulsar.app.viewmodel.PostViewModel

@SuppressLint("MissingPermission")
@Composable
fun MapScreen(
    authViewModel: AuthViewModel,
    postViewModel: PostViewModel,
    onCreatePost: () -> Unit,
) {
    val context = LocalContext.current
    val posts by postViewModel.posts.collectAsState()

    // Configurar osmdroid
    Configuration.getInstance().userAgentValue = context.packageName

    var mapView by remember { mutableStateOf<MapView?>(null) }
    var locationOverlay by remember { mutableStateOf<MyLocationNewOverlay?>(null) }

    // Atualizar marcadores quando posts mudam
    LaunchedEffect(posts) {
        val map = mapView ?: return@LaunchedEffect
        // Remove marcadores de posts antigos (mantém locationOverlay)
        map.overlays.removeAll { it is Marker }
        posts.forEach { post ->
            val marker = Marker(map).apply {
                position = GeoPoint(post.latitude, post.longitude)
                title = post.userName
                snippet = post.content.take(60) + if (post.content.length > 60) "..." else ""
                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                icon = createPulsarMarkerIcon(context)
            }
            map.overlays.add(marker)
        }
        map.invalidate()
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // Mapa OSM
        AndroidView(
            factory = { ctx ->
                MapView(ctx).apply {
                    setTileSource(TileSourceFactory.MAPNIK)
                    setMultiTouchControls(true)
                    controller.setZoom(15.0)
                    controller.setCenter(GeoPoint(-23.5505, -46.6333)) // São Paulo padrão

                    // Camada de localização do usuário
                    val myLocation = MyLocationNewOverlay(GpsMyLocationProvider(ctx), this)
                    myLocation.enableMyLocation()
                    myLocation.enableFollowLocation()
                    myLocation.runOnFirstFix {
                        post {
                            controller.animateTo(myLocation.myLocation)
                        }
                    }
                    overlays.add(myLocation)
                    locationOverlay = myLocation
                    mapView = this

                    // Estilo escuro via filtro de cor
                    setBackgroundColor(android.graphics.Color.parseColor("#0A0A0A"))
                }
            },
            modifier = Modifier.fillMaxSize(),
            update = { map ->
                mapView = map
            }
        )

        // Top Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(androidx.compose.ui.graphics.Color(0xCC0A0A0A))
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(PulsarCyan, CircleShape)
                )
                Text(
                    text = "PULSAR",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = PulsarCyan,
                    letterSpacing = 4.sp
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = PulsarCyan.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = "${posts.size} pulsos",
                        color = PulsarCyan,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
                IconButton(
                    onClick = { authViewModel.logout() },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Default.ExitToApp,
                        contentDescription = "Sair",
                        tint = androidx.compose.ui.graphics.Color.Gray,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }

        // FAB
        FloatingActionButton(
            onClick = onCreatePost,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .navigationBarsPadding()
                .padding(24.dp),
            containerColor = PulsarCyan,
            contentColor = PulsarBackground,
            shape = CircleShape
        ) {
            Icon(
                Icons.Default.Add,
                contentDescription = "Novo pulso",
                modifier = Modifier.size(28.dp)
            )
        }
    }
}

fun createPulsarMarkerIcon(context: android.content.Context): android.graphics.drawable.Drawable {
    val size = 40
    val bitmap = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    val paintOuter = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#2200FFD1")
        style = Paint.Style.FILL
    }
    val paintInner = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#00FFD1")
        style = Paint.Style.FILL
    }
    val paintBorder = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#00FFD1")
        style = Paint.Style.STROKE
        strokeWidth = 2f
    }

    canvas.drawCircle(size / 2f, size / 2f, size / 2f, paintOuter)
    canvas.drawCircle(size / 2f, size / 2f, size / 2f - 2, paintBorder)
    canvas.drawCircle(size / 2f, size / 2f, 8f, paintInner)

    return android.graphics.drawable.BitmapDrawable(context.resources, bitmap)
}
