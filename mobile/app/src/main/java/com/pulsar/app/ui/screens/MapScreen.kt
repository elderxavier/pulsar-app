package com.pulsar.app.ui.screens

import android.annotation.SuppressLint
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material.icons.outlined.ThumbUp
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.google.firebase.auth.FirebaseAuth
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.OnlineTileSourceBase
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.tileprovider.tilesource.XYTileSource
import org.osmdroid.util.GeoPoint
import org.osmdroid.util.MapTileIndex
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.mylocation.GpsMyLocationProvider
import org.osmdroid.views.overlay.mylocation.MyLocationNewOverlay
import com.pulsar.app.ui.theme.PulsarBackground
import com.pulsar.app.ui.theme.PulsarCyan
import com.pulsar.app.viewmodel.AuthViewModel
import com.pulsar.app.viewmodel.PostViewModel

enum class MapType(val label: String) {
    PADRAO("Padrão"),
    SATELITE("Satélite"),
    RELEVO("Relevo")
}

private val EsriSatelliteTileSource = object : OnlineTileSourceBase(
    "Esri Satellite", 1, 19, 256, ".jpg",
    arrayOf("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/")
) {
    override fun getTileURLString(pMapTileIndex: Long): String {
        val z = MapTileIndex.getZoom(pMapTileIndex)
        val y = MapTileIndex.getY(pMapTileIndex)
        val x = MapTileIndex.getX(pMapTileIndex)
        return "$baseUrl$z/$y/$x"
    }
}

private val OpenTopoTileSource = XYTileSource(
    "OpenTopoMap", 1, 17, 256, ".png",
    arrayOf("https://tile.opentopomap.org/")
)

@SuppressLint("MissingPermission")
@OptIn(ExperimentalMaterial3Api::class)
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

    val currentUid = remember { FirebaseAuth.getInstance().currentUser?.uid }

    var mapView by remember { mutableStateOf<MapView?>(null) }
    var locationOverlay by remember { mutableStateOf<MyLocationNewOverlay?>(null) }
    var selectedMapType by remember { mutableStateOf(MapType.PADRAO) }
    var userLocation by remember { mutableStateOf<GeoPoint?>(null) }
    var showNearbySheet by remember { mutableStateOf(false) }
    var selectedPostId by remember { mutableStateOf<String?>(null) }
    val selectedPost = remember(posts, selectedPostId) {
        selectedPostId?.let { id -> posts.find { it.id == id } }
    }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
    val postSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var radiusKm by remember { mutableIntStateOf(15) }
    var searchQuery by remember { mutableStateOf("") }
    var showProfile by remember { mutableStateOf(false) }
    val profileSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val nearbyPosts = remember(posts, userLocation, radiusKm) {
        val loc = userLocation ?: return@remember emptyList()
        posts
            .map { post -> post to GeoPoint(post.latitude, post.longitude).distanceToAsDouble(loc) }
            .filter { (_, dist) -> dist <= radiusKm * 1_000.0 }
            .sortedBy { (_, dist) -> dist }
            .map { (post, dist) -> post to dist }
    }

    val filteredNearbyPosts = remember(nearbyPosts, searchQuery) {
        if (searchQuery.isBlank()) nearbyPosts
        else {
            val q = searchQuery.trim().lowercase()
            nearbyPosts.filter { (post, _) ->
                post.title.lowercase().contains(q) ||
                post.content.lowercase().contains(q) ||
                post.userName.lowercase().contains(q)
            }
        }
    }

    LaunchedEffect(selectedMapType) {
        val map = mapView ?: return@LaunchedEffect
        val source = when (selectedMapType) {
            MapType.PADRAO -> TileSourceFactory.MAPNIK
            MapType.SATELITE -> EsriSatelliteTileSource
            MapType.RELEVO -> OpenTopoTileSource
        }
        map.setTileSource(source)
        map.invalidate()
    }

    // Zoom para cobrir o raio selecionado quando ele mudar
    LaunchedEffect(radiusKm) {
        val map = mapView ?: return@LaunchedEffect
        val loc = userLocation ?: return@LaunchedEffect
        val latRad = Math.toRadians(loc.latitude)
        val deltaLat = radiusKm / 111.0
        val deltaLon = radiusKm / (111.0 * Math.cos(latRad))
        val bbox = org.osmdroid.util.BoundingBox(
            loc.latitude + deltaLat,
            loc.longitude + deltaLon,
            loc.latitude - deltaLat,
            loc.longitude - deltaLon
        )
        map.post { map.zoomToBoundingBox(bbox, true, 80) }
    }

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
                setOnMarkerClickListener { _, _ ->
                    selectedPostId = post.id
                    true
                }
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
                    controller.setZoom(19.0)

                    // Camada de localização do usuário
                    val myLocation = MyLocationNewOverlay(GpsMyLocationProvider(ctx), this)
                    myLocation.enableMyLocation()
                    myLocation.setPersonIcon(createMyLocationBitmap())
                    myLocation.setDirectionIcon(createMyLocationBitmap())
                    myLocation.runOnFirstFix {
                        post {
                            myLocation.myLocation?.let {
                                controller.animateTo(it)
                                controller.setZoom(19.0)
                                userLocation = it
                            }
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
                    color = PulsarCyan.copy(alpha = 0.15f),
                    onClick = { showNearbySheet = true }
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = "${nearbyPosts.size}/${posts.size} · $radiusKm km",
                            color = PulsarCyan,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Icon(
                            Icons.Default.List,
                            contentDescription = "Lista de pulsos",
                            tint = PulsarCyan,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
                // Avatar / Perfil
                val currentUser by authViewModel.user.collectAsState()
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(PulsarCyan.copy(alpha = 0.2f))
                        .clickable { showProfile = true },
                    contentAlignment = Alignment.Center,
                ) {
                    val myPhoto by authViewModel.myPhotoURL.collectAsState()
                    if (myPhoto.isNotEmpty()) {
                        AsyncImage(model = myPhoto, contentDescription = "Perfil", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    } else {
                        Text(
                            (currentUser?.displayName ?: currentUser?.email ?: "A").firstOrNull()?.uppercase() ?: "A",
                            color = PulsarCyan,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                        )
                    }
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

        // Seletor de tipo de mapa
        Row(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .navigationBarsPadding()
                .padding(start = 16.dp, bottom = 100.dp)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            MapType.entries.forEach { type ->
                val isSelected = type == selectedMapType
                FilterChip(
                    selected = isSelected,
                    onClick = { selectedMapType = type },
                    label = {
                        Text(
                            text = type.label,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                        )
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = PulsarCyan,
                        selectedLabelColor = PulsarBackground,
                        containerColor = androidx.compose.ui.graphics.Color(0xDD1A1A1A),
                        labelColor = androidx.compose.ui.graphics.Color.White
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = isSelected,
                        selectedBorderColor = PulsarCyan,
                        borderColor = androidx.compose.ui.graphics.Color(0xFF444444)
                    )
                )
            }
        }

        // Botão centralizar na minha localização
        FloatingActionButton(
            onClick = {
                locationOverlay?.myLocation?.let { loc ->
                    mapView?.controller?.animateTo(loc)
                }
            },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .navigationBarsPadding()
                .padding(end = 24.dp, bottom = 100.dp),
            containerColor = androidx.compose.ui.graphics.Color(0xDD0A0A0A),
            contentColor = PulsarCyan,
            shape = CircleShape,
            elevation = FloatingActionButtonDefaults.elevation(4.dp)
        ) {
            Icon(
                Icons.Default.MyLocation,
                contentDescription = "Minha localização",
                modifier = Modifier.size(22.dp)
            )
        }

        // FAB novo pulso
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

        // Bottom sheet — posts no raio selecionado
        if (showNearbySheet) {
            ModalBottomSheet(
                onDismissRequest = { showNearbySheet = false; searchQuery = "" },
                sheetState = sheetState,
                containerColor = androidx.compose.ui.graphics.Color(0xFF121212),
                dragHandle = {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                            .padding(top = 12.dp, bottom = 8.dp)
                    ) {
                        // Drag handle
                        Box(
                            modifier = Modifier
                                .width(40.dp)
                                .height(4.dp)
                                .background(
                                    androidx.compose.ui.graphics.Color(0xFF444444),
                                    RoundedCornerShape(2.dp)
                                )
                                .align(Alignment.CenterHorizontally)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        // Title + count badge
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Pulsos próximos",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = androidx.compose.ui.graphics.Color.White
                            )
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = PulsarCyan.copy(alpha = 0.15f)
                            ) {
                                Text(
                                    text = "$radiusKm km · ${filteredNearbyPosts.size}",
                                    color = PulsarCyan,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        // Search field
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            placeholder = {
                                Text(
                                    "Buscar título, descrição ou usuário…",
                                    fontSize = 13.sp,
                                    color = androidx.compose.ui.graphics.Color(0xFF666666)
                                )
                            },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = PulsarCyan,
                                unfocusedBorderColor = androidx.compose.ui.graphics.Color(0xFF333333),
                                focusedTextColor = androidx.compose.ui.graphics.Color.White,
                                unfocusedTextColor = androidx.compose.ui.graphics.Color.White,
                                cursorColor = PulsarCyan,
                                focusedContainerColor = androidx.compose.ui.graphics.Color(0xFF1A1A1A),
                                unfocusedContainerColor = androidx.compose.ui.graphics.Color(0xFF1A1A1A),
                            ),
                            shape = RoundedCornerShape(10.dp),
                            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 13.sp),
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        // Radius chips
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            listOf(5, 10, 15, 25, 50, 100, 150).forEach { km ->
                                val selected = km == radiusKm
                                FilterChip(
                                    selected = selected,
                                    onClick = { radiusKm = km },
                                    label = {
                                        Text(
                                            text = "$km km",
                                            fontSize = 11.sp,
                                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                                        )
                                    },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = PulsarCyan,
                                        selectedLabelColor = androidx.compose.ui.graphics.Color(0xFF0A0A0A),
                                        containerColor = androidx.compose.ui.graphics.Color(0xFF1E1E1E),
                                        labelColor = androidx.compose.ui.graphics.Color(0xFFAAAAAA)
                                    ),
                                    border = FilterChipDefaults.filterChipBorder(
                                        enabled = true,
                                        selected = selected,
                                        selectedBorderColor = PulsarCyan,
                                        borderColor = androidx.compose.ui.graphics.Color(0xFF333333)
                                    )
                                )
                            }
                        }
                    }
                }
            ) {
                if (filteredNearbyPosts.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(160.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.Place,
                                contentDescription = null,
                                tint = androidx.compose.ui.graphics.Color(0xFF444444),
                                modifier = Modifier.size(40.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = if (userLocation == null) "Aguardando localização GPS…"
                                       else if (searchQuery.isNotBlank()) "Nenhum resultado para \"$searchQuery\""
                                       else "Nenhum pulso no raio de $radiusKm km",
                                color = androidx.compose.ui.graphics.Color(0xFF666666),
                                fontSize = 14.sp
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(
                            start = 16.dp, end = 16.dp,
                            top = 4.dp, bottom = 32.dp
                        ),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(filteredNearbyPosts, key = { (post, _) -> post.id }) { (post, distMeters) ->
                            val distLabel = if (distMeters < 1000)
                                "${distMeters.toInt()} m"
                            else
                                "${"%.1f".format(distMeters / 1000)} km"

                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = androidx.compose.ui.graphics.Color(0xFF1E1E1E),
                                onClick = {
                                    mapView?.controller?.animateTo(GeoPoint(post.latitude, post.longitude))
                                    showNearbySheet = false
                                    selectedPostId = post.id
                                }
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.Top
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = post.userName,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = PulsarCyan
                                        )
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = post.content,
                                            fontSize = 13.sp,
                                            color = androidx.compose.ui.graphics.Color(0xFFCCCCCC),
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = androidx.compose.ui.graphics.Color(0xFF2A2A2A)
                                    ) {
                                        Text(
                                            text = distLabel,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = androidx.compose.ui.graphics.Color(0xFF888888),
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
        }
        }

        // Bottom sheet — detalhe do post
        selectedPost?.let { post ->
            PostDetailSheet(
                post = post,
                isOwner = post.userId == currentUid,
                currentUid = currentUid,
                viewModel = postViewModel,
                sheetState = postSheetState,
                onDismiss = { selectedPostId = null },
                onEdit = { newContent ->
                    postViewModel.updatePost(post.id, newContent)
                    selectedPostId = null
                },
                onDelete = {
                    postViewModel.deletePost(post.id)
                    selectedPostId = null
                }
            )
        }

        // Bottom sheet — perfil
        if (showProfile) {
            ProfileSheet(
                authViewModel = authViewModel,
                sheetState = profileSheetState,
                onDismiss = { showProfile = false },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileSheet(
    authViewModel: AuthViewModel,
    sheetState: SheetState,
    onDismiss: () -> Unit,
) {
    val user by authViewModel.user.collectAsState()
    val loading by authViewModel.loading.collectAsState()
    val myPhoto by authViewModel.myPhotoURL.collectAsState()
    var nameInput by remember { mutableStateOf(user?.displayName ?: "") }
    val ctx = LocalContext.current

    val pickImage = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) authViewModel.uploadAvatar(ctx, uri)
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = androidx.compose.ui.graphics.Color(0xFF121212),
    ) {
        Column(
            modifier = androidx.compose.ui.Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(top = 8.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Meu perfil", color = androidx.compose.ui.graphics.Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)

            // Avatar grande clicável
            Box(
                modifier = androidx.compose.ui.Modifier
                    .size(96.dp)
                    .clip(CircleShape)
                    .background(PulsarCyan.copy(alpha = 0.2f))
                    .clickable { pickImage.launch("image/*") },
                contentAlignment = Alignment.Center,
            ) {
                if (myPhoto.isNotEmpty()) {
                    AsyncImage(model = myPhoto, contentDescription = "Avatar", contentScale = ContentScale.Crop, modifier = androidx.compose.ui.Modifier.fillMaxSize())
                } else {
                    Text(
                        (user?.displayName ?: user?.email ?: "A").firstOrNull()?.uppercase() ?: "A",
                        color = PulsarCyan,
                        fontWeight = FontWeight.Bold,
                        fontSize = 36.sp,
                    )
                }
                if (loading) {
                    Box(modifier = androidx.compose.ui.Modifier.matchParentSize().background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.5f)), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PulsarCyan, modifier = androidx.compose.ui.Modifier.size(28.dp), strokeWidth = 3.dp)
                    }
                }
            }
            Text("Toque para alterar (máx 2MB)", color = androidx.compose.ui.graphics.Color(0xFF888888), fontSize = 11.sp)

            Spacer(modifier = androidx.compose.ui.Modifier.height(4.dp))

            // Nome
            OutlinedTextField(
                value = nameInput,
                onValueChange = { if (it.length <= 40) nameInput = it },
                label = { Text("Nome de exibição") },
                modifier = androidx.compose.ui.Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PulsarCyan,
                    unfocusedBorderColor = androidx.compose.ui.graphics.Color(0xFF333333),
                    focusedLabelColor = PulsarCyan,
                    unfocusedLabelColor = androidx.compose.ui.graphics.Color(0xFF888888),
                    focusedTextColor = androidx.compose.ui.graphics.Color.White,
                    unfocusedTextColor = androidx.compose.ui.graphics.Color.White,
                    cursorColor = PulsarCyan,
                ),
            )

            // Email (readonly)
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = androidx.compose.ui.graphics.Color(0xFF1A1A1A),
                modifier = androidx.compose.ui.Modifier.fillMaxWidth(),
            ) {
                Column(modifier = androidx.compose.ui.Modifier.padding(12.dp)) {
                    Text("Email", color = androidx.compose.ui.graphics.Color(0xFF888888), fontSize = 11.sp)
                    Text(user?.email ?: "—", color = androidx.compose.ui.graphics.Color.White, fontSize = 13.sp, modifier = androidx.compose.ui.Modifier.padding(top = 2.dp))
                }
            }

            Button(
                onClick = { authViewModel.updateDisplayName(nameInput.trim()) { ok -> if (ok) onDismiss() } },
                enabled = !loading && nameInput.isNotBlank(),
                modifier = androidx.compose.ui.Modifier.fillMaxWidth().height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PulsarCyan, contentColor = PulsarBackground),
                shape = RoundedCornerShape(12.dp),
            ) {
                Text("Salvar", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostDetailSheet(
    post: com.pulsar.app.data.model.Post,
    isOwner: Boolean,
    currentUid: String?,
    viewModel: PostViewModel,
    sheetState: SheetState,
    onDismiss: () -> Unit,
    onEdit: (String) -> Unit,
    onDelete: () -> Unit,
) {
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var showEditDialog by remember { mutableStateOf(false) }
    var editContent by remember { mutableStateOf(post.content) }
    var showImageFullscreen by remember { mutableStateOf(false) }
    var commentText by remember { mutableStateOf("") }

    val commentsByPost by viewModel.comments.collectAsState()
    val comments = commentsByPost[post.id] ?: emptyList()
    val liked = currentUid != null && post.likedBy.contains(currentUid)

    DisposableEffect(post.id) {
        viewModel.listenComments(post.id)
        onDispose { viewModel.stopListeningComments(post.id) }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Excluir pulso") },
            text = { Text("Tem certeza que deseja excluir este pulso? Esta ação não pode ser desfeita.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    onDelete()
                }) { Text("Excluir", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("Cancelar") }
            },
            containerColor = androidx.compose.ui.graphics.Color(0xFF1A1A1A)
        )
    }

    if (showEditDialog) {
        AlertDialog(
            onDismissRequest = { showEditDialog = false },
            title = { Text("Editar pulso", color = androidx.compose.ui.graphics.Color.White) },
            text = {
                OutlinedTextField(
                    value = editContent,
                    onValueChange = { if (it.length <= 280) editContent = it },
                    modifier = Modifier.fillMaxWidth().height(140.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PulsarCyan,
                        unfocusedBorderColor = androidx.compose.ui.graphics.Color(0xFF444444),
                        focusedTextColor = androidx.compose.ui.graphics.Color.White,
                        unfocusedTextColor = androidx.compose.ui.graphics.Color.White,
                        cursorColor = PulsarCyan,
                    ),
                    maxLines = 6,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = { showEditDialog = false; onEdit(editContent.trim()) },
                    enabled = editContent.isNotBlank()
                ) { Text("Salvar", color = PulsarCyan) }
            },
            dismissButton = {
                TextButton(onClick = { showEditDialog = false }) { Text("Cancelar") }
            },
            containerColor = androidx.compose.ui.graphics.Color(0xFF1A1A1A)
        )
    }

    // Fullscreen image
    if (showImageFullscreen && post.imageUrl.startsWith("http")) {
        Dialog(
            onDismissRequest = { showImageFullscreen = false },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(
                modifier = androidx.compose.ui.Modifier
                    .fillMaxSize()
                    .background(androidx.compose.ui.graphics.Color.Black)
            ) {
                AsyncImage(
                    model = post.imageUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = androidx.compose.ui.Modifier.fillMaxSize()
                )
                IconButton(
                    onClick = { showImageFullscreen = false },
                    modifier = androidx.compose.ui.Modifier.align(Alignment.TopEnd).padding(16.dp)
                ) {
                    Icon(
                        Icons.Default.Place,
                        contentDescription = "Fechar",
                        tint = androidx.compose.ui.graphics.Color.White
                    )
                }
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = androidx.compose.ui.graphics.Color(0xFF121212),
        dragHandle = {
            Box(
                modifier = androidx.compose.ui.Modifier
                    .width(40.dp)
                    .height(4.dp)
                    .background(
                        androidx.compose.ui.graphics.Color(0xFF444444),
                        RoundedCornerShape(2.dp)
                    )
            )
        }
    ) {
        Column(
            modifier = androidx.compose.ui.Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(top = 16.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header: avatar placeholder + nome + ações
            Row(
                modifier = androidx.compose.ui.Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(
                        modifier = androidx.compose.ui.Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(PulsarCyan.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        if (post.userPhotoURL.isNotEmpty()) {
                            AsyncImage(model = post.userPhotoURL, contentDescription = post.userName, contentScale = ContentScale.Crop, modifier = androidx.compose.ui.Modifier.fillMaxSize())
                        } else {
                            Text(
                                text = post.userName.firstOrNull()?.uppercase() ?: "?",
                                color = PulsarCyan,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                        }
                    }
                    Column {
                        Text(post.userName, color = androidx.compose.ui.graphics.Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Text("📍 ${post.latitude.let { "%.4f".format(it) }}, ${post.longitude.let { "%.4f".format(it) }}", color = androidx.compose.ui.graphics.Color(0xFF666666), fontSize = 10.sp)
                    }
                }
                if (isOwner) {
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        IconButton(onClick = { showEditDialog = true }, modifier = androidx.compose.ui.Modifier.size(36.dp)) {
                            Icon(Icons.Default.Edit, contentDescription = "Editar", tint = PulsarCyan, modifier = androidx.compose.ui.Modifier.size(18.dp))
                        }
                        IconButton(onClick = { showDeleteConfirm = true }, modifier = androidx.compose.ui.Modifier.size(36.dp)) {
                            Icon(Icons.Default.Delete, contentDescription = "Excluir", tint = MaterialTheme.colorScheme.error, modifier = androidx.compose.ui.Modifier.size(18.dp))
                        }
                    }
                }
            }

            HorizontalDivider(color = androidx.compose.ui.graphics.Color(0xFF2A2A2A))

            // Título + Conteúdo
            if (post.title.isNotEmpty()) {
                Text(post.title, color = androidx.compose.ui.graphics.Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold, lineHeight = 24.sp)
            }
            Text(post.content, color = androidx.compose.ui.graphics.Color(0xFFEEEEEE), fontSize = 15.sp, lineHeight = 22.sp)

            // Imagem
            if (post.imageUrl.isNotEmpty()) {
                if (post.imageUrl.startsWith("http")) {
                    AsyncImage(
                        model = post.imageUrl,
                        contentDescription = "Imagem do post",
                        contentScale = ContentScale.Crop,
                        modifier = androidx.compose.ui.Modifier
                            .fillMaxWidth()
                            .height(220.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .then(androidx.compose.ui.Modifier.clickable { showImageFullscreen = true })
                    )
                } else {
                    Surface(shape = RoundedCornerShape(8.dp), color = androidx.compose.ui.graphics.Color(0xFF1E1E1E)) {
                        Row(modifier = androidx.compose.ui.Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Place, contentDescription = null, tint = androidx.compose.ui.graphics.Color(0xFF555555), modifier = androidx.compose.ui.Modifier.size(20.dp))
                            Text("Imagem disponível apenas no dispositivo de origem", color = androidx.compose.ui.graphics.Color(0xFF666666), fontSize = 12.sp)
                        }
                    }
                }
            }

            // Botão Traçar Rota
            val routeContext = LocalContext.current
            Button(
                onClick = {
                    val uri = android.net.Uri.parse(
                        "https://www.google.com/maps/dir/?api=1&destination=${post.latitude},${post.longitude}&travelmode=driving"
                    )
                    val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, uri)
                    routeContext.startActivity(intent)
                },
                modifier = androidx.compose.ui.Modifier.fillMaxWidth().height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PulsarCyan, contentColor = PulsarBackground),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(
                        Icons.Default.Place,
                        contentDescription = null,
                        modifier = androidx.compose.ui.Modifier.size(18.dp)
                    )
                    Text("Traçar rota", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }

            // Vídeo
            if (post.videoUrl.isNotEmpty()) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = androidx.compose.ui.graphics.Color(0xFF1A1A1A),
                    border = androidx.compose.foundation.BorderStroke(1.dp, androidx.compose.ui.graphics.Color(0xFF2A2A2A))
                ) {
                    Row(
                        modifier = androidx.compose.ui.Modifier.fillMaxWidth().padding(14.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = androidx.compose.ui.Modifier
                                .size(44.dp)
                                .background(PulsarCyan.copy(alpha = 0.15f), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Videocam, contentDescription = null, tint = PulsarCyan, modifier = androidx.compose.ui.Modifier.size(22.dp))
                        }
                        Column {
                            Text("Vídeo anexado", color = androidx.compose.ui.graphics.Color.White, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            Text("Disponível no dispositivo de origem", color = androidx.compose.ui.graphics.Color(0xFF666666), fontSize = 11.sp)
                        }
                    }
                }
            }

            // Like + contadores
            HorizontalDivider(color = androidx.compose.ui.graphics.Color(0xFF2A2A2A))
            Row(
                modifier = androidx.compose.ui.Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Surface(
                    onClick = { viewModel.toggleLike(post.id) },
                    shape = RoundedCornerShape(20.dp),
                    color = if (liked) PulsarCyan.copy(alpha = 0.15f) else androidx.compose.ui.graphics.Color(0xFF1A1A1A),
                    border = androidx.compose.foundation.BorderStroke(1.dp, if (liked) PulsarCyan else androidx.compose.ui.graphics.Color(0xFF2A2A2A)),
                ) {
                    Row(
                        modifier = androidx.compose.ui.Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(
                            if (liked) Icons.Default.ThumbUp else Icons.Outlined.ThumbUp,
                            contentDescription = "Curtir",
                            tint = if (liked) PulsarCyan else androidx.compose.ui.graphics.Color(0xFF999999),
                            modifier = androidx.compose.ui.Modifier.size(18.dp),
                        )
                        Text(
                            text = "${post.likesCount}",
                            color = if (liked) PulsarCyan else androidx.compose.ui.graphics.Color(0xFFCCCCCC),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
                Text(
                    text = "${comments.size} comentário${if (comments.size != 1) "s" else ""}",
                    color = androidx.compose.ui.graphics.Color(0xFF888888),
                    fontSize = 12.sp,
                    modifier = androidx.compose.ui.Modifier.padding(start = 4.dp),
                )
            }

            // Lista de comentários
            if (comments.isNotEmpty()) {
                var editingCommentId by remember { mutableStateOf<String?>(null) }
                var editingText by remember { mutableStateOf("") }
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    comments.forEach { c ->
                        Surface(shape = RoundedCornerShape(10.dp), color = androidx.compose.ui.graphics.Color(0xFF1A1A1A)) {
                            Row(modifier = androidx.compose.ui.Modifier.fillMaxWidth().padding(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Box(
                                    modifier = androidx.compose.ui.Modifier.size(32.dp).clip(CircleShape).background(PulsarCyan.copy(alpha = 0.2f)),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    if (c.userPhotoURL.isNotEmpty()) {
                                        AsyncImage(model = c.userPhotoURL, contentDescription = c.userName, contentScale = ContentScale.Crop, modifier = androidx.compose.ui.Modifier.fillMaxSize())
                                    } else {
                                        Text(c.userName.firstOrNull()?.uppercase() ?: "?", color = PulsarCyan, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                    }
                                }
                                Column(modifier = androidx.compose.ui.Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = androidx.compose.ui.Modifier.fillMaxWidth()) {
                                        Text(c.userName, color = PulsarCyan, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                        if (c.userId == currentUid && editingCommentId != c.id) {
                                            Row {
                                                IconButton(onClick = { editingCommentId = c.id; editingText = c.content }, modifier = androidx.compose.ui.Modifier.size(24.dp)) {
                                                    Icon(Icons.Default.Edit, contentDescription = "Editar", tint = androidx.compose.ui.graphics.Color(0xFF666666), modifier = androidx.compose.ui.Modifier.size(14.dp))
                                                }
                                                IconButton(onClick = { viewModel.deleteComment(post.id, c.id) }, modifier = androidx.compose.ui.Modifier.size(24.dp)) {
                                                    Icon(Icons.Default.Delete, contentDescription = "Excluir", tint = androidx.compose.ui.graphics.Color(0xFF666666), modifier = androidx.compose.ui.Modifier.size(14.dp))
                                                }
                                            }
                                        }
                                    }
                                    if (editingCommentId == c.id) {
                                        Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = androidx.compose.ui.Modifier.padding(top = 4.dp)) {
                                            OutlinedTextField(
                                                value = editingText,
                                                onValueChange = { if (it.length <= 280) editingText = it },
                                                modifier = androidx.compose.ui.Modifier.fillMaxWidth(),
                                                colors = OutlinedTextFieldDefaults.colors(
                                                    focusedBorderColor = PulsarCyan,
                                                    unfocusedBorderColor = androidx.compose.ui.graphics.Color(0xFF333333),
                                                    focusedTextColor = androidx.compose.ui.graphics.Color.White,
                                                    unfocusedTextColor = androidx.compose.ui.graphics.Color.White,
                                                    cursorColor = PulsarCyan,
                                                ),
                                                textStyle = androidx.compose.ui.text.TextStyle(fontSize = 13.sp),
                                                maxLines = 4,
                                            )
                                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                TextButton(onClick = { editingCommentId = null }) { Text("Cancelar", fontSize = 12.sp) }
                                                TextButton(
                                                    onClick = { viewModel.updateComment(post.id, c.id, editingText); editingCommentId = null },
                                                    enabled = editingText.isNotBlank(),
                                                ) { Text("Salvar", color = PulsarCyan, fontSize = 12.sp) }
                                            }
                                        }
                                    } else {
                                        Text(c.content, color = androidx.compose.ui.graphics.Color(0xFFEEEEEE), fontSize = 13.sp, modifier = androidx.compose.ui.Modifier.padding(top = 2.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Input para novo comentário
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = androidx.compose.ui.Modifier.fillMaxWidth(),
            ) {
                OutlinedTextField(
                    value = commentText,
                    onValueChange = { if (it.length <= 280) commentText = it },
                    placeholder = { Text("Adicionar um comentário…", color = androidx.compose.ui.graphics.Color(0xFF666666), fontSize = 13.sp) },
                    modifier = androidx.compose.ui.Modifier.weight(1f),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PulsarCyan,
                        unfocusedBorderColor = androidx.compose.ui.graphics.Color(0xFF333333),
                        focusedTextColor = androidx.compose.ui.graphics.Color.White,
                        unfocusedTextColor = androidx.compose.ui.graphics.Color.White,
                        cursorColor = PulsarCyan,
                        focusedContainerColor = androidx.compose.ui.graphics.Color(0xFF1A1A1A),
                        unfocusedContainerColor = androidx.compose.ui.graphics.Color(0xFF1A1A1A),
                    ),
                    shape = RoundedCornerShape(20.dp),
                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 13.sp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                )
                IconButton(
                    onClick = {
                        if (commentText.isNotBlank()) {
                            viewModel.addComment(post.id, commentText)
                            commentText = ""
                        }
                    },
                    enabled = commentText.isNotBlank(),
                    modifier = androidx.compose.ui.Modifier
                        .size(44.dp)
                        .background(if (commentText.isNotBlank()) PulsarCyan else androidx.compose.ui.graphics.Color(0xFF333333), CircleShape),
                ) {
                    Icon(
                        Icons.Default.Send,
                        contentDescription = "Enviar",
                        tint = if (commentText.isNotBlank()) PulsarBackground else androidx.compose.ui.graphics.Color(0xFF666666),
                        modifier = androidx.compose.ui.Modifier.size(20.dp),
                    )
                }
            }
        }
    }
}

fun createMyLocationBitmap(): android.graphics.Bitmap {
    val size = 64
    val bitmap = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val cx = size / 2f
    val cy = size / 2f

    // Halo externo pulsante — cyan bem visível
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#5500FFD1")
        style = Paint.Style.FILL
    }.also { canvas.drawCircle(cx, cy, size / 2f, it) }

    // Anel intermediário branco para separar do fundo do mapa
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.FILL
    }.also { canvas.drawCircle(cx, cy, 20f, it) }

    // Núcleo azul-índigo — contraste máximo em tiles claros e satélite
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#1A237E")
        style = Paint.Style.FILL
    }.also { canvas.drawCircle(cx, cy, 14f, it) }

    // Ponto central cyan brilhante
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#00FFD1")
        style = Paint.Style.FILL
    }.also { canvas.drawCircle(cx, cy, 7f, it) }

    return bitmap
}

fun createPulsarMarkerIcon(context: android.content.Context): android.graphics.drawable.Drawable {
    val w = 56
    val h = 72 // pin shape: circle head + triangular tail
    val bitmap = android.graphics.Bitmap.createBitmap(w, h, android.graphics.Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val cx = w / 2f
    val r = w / 2f

    // Sombra leve
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#44000000")
        style = Paint.Style.FILL
    }.also { canvas.drawCircle(cx + 2f, r + 2f, r - 2f, it) }

    // Corpo do pin — fundo escuro com borda cyan
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#CC0A0A0A")
        style = Paint.Style.FILL
    }.also { canvas.drawCircle(cx, r, r - 1f, it) }

    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#00FFD1")
        style = Paint.Style.STROKE
        strokeWidth = 3f
    }.also { canvas.drawCircle(cx, r, r - 2.5f, it) }

    // Ponto central cyan
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#00FFD1")
        style = Paint.Style.FILL
    }.also { canvas.drawCircle(cx, r, 10f, it) }

    // Cauda triangular do pin
    val path = android.graphics.Path().apply {
        moveTo(cx - 8f, r + r - 6f)
        lineTo(cx + 8f, r + r - 6f)
        lineTo(cx, h.toFloat())
        close()
    }
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#00FFD1")
        style = Paint.Style.FILL
    }.also { canvas.drawPath(path, it) }

    return android.graphics.drawable.BitmapDrawable(context.resources, bitmap)
}
