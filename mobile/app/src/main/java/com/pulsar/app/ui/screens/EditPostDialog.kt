package com.pulsar.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.pulsar.app.data.model.Post
import com.pulsar.app.ui.theme.PulsarBackground
import com.pulsar.app.ui.theme.PulsarCyan
import com.pulsar.app.ui.theme.PulsarGray
import com.pulsar.app.ui.theme.PulsarSurface
import com.pulsar.app.viewmodel.PostViewModel

/**
 * Dialog de edição de post — fullscreen.
 *
 * Mídia: 3 estados por tipo (image/video):
 *   - Mantém a atual (default): newUri == null && remove == false
 *   - Substitui:                newUri != null
 *   - Remove:                   remove == true
 *
 * Fecha automaticamente quando `postSuccess` vira true (LaunchedEffect).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditPostDialog(
    post: Post,
    viewModel: PostViewModel,
    onDismiss: () -> Unit,
) {
    var title       by remember { mutableStateOf(post.title) }
    var content     by remember { mutableStateOf(post.content) }
    var newImageUri by remember { mutableStateOf<Uri?>(null) }
    var newVideoUri by remember { mutableStateOf<Uri?>(null) }
    var removeImage by remember { mutableStateOf(false) }
    var removeVideo by remember { mutableStateOf(false) }

    val loading        by viewModel.loading.collectAsState()
    val error          by viewModel.error.collectAsState()
    val postSuccess    by viewModel.postSuccess.collectAsState()
    val uploadProgress by viewModel.uploadProgress.collectAsState()

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) { newImageUri = uri; removeImage = false }
    }
    val videoPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) { newVideoUri = uri; removeVideo = false }
    }

    // Fecha quando o update concluir com sucesso.
    LaunchedEffect(postSuccess) {
        if (postSuccess) {
            viewModel.resetPostSuccess()
            onDismiss()
        }
    }

    // ----- Estado derivado da mídia (o que mostrar no preview) -----
    val currentImageUrl = post.imageUrl
    val currentVideoUrl = post.videoUrl
    val displayImage: Any? = when {
        newImageUri != null -> newImageUri
        removeImage         -> null
        currentImageUrl.startsWith("http") -> currentImageUrl
        else -> null
    }
    val hasVideo: Boolean = when {
        newVideoUri != null -> true
        removeVideo         -> false
        else                -> currentVideoUrl.startsWith("http")
    }

    val isDirty = title != post.title ||
        content != post.content ||
        newImageUri != null || removeImage ||
        newVideoUri != null || removeVideo

    Dialog(
        onDismissRequest = { if (!loading) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = !loading),
    ) {
        Box(modifier = Modifier.fillMaxSize().background(PulsarBackground)) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Top bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF111111))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = onDismiss, enabled = !loading) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Fechar", tint = Color.White)
                    }
                    Text("Editar pulso", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Color.White)
                }

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    // Título
                    OutlinedTextField(
                        value = title,
                        onValueChange = { if (it.length <= 100) title = it },
                        placeholder = { Text("Título", color = Color.Gray) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = textFieldColors(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true,
                    )

                    // Conteúdo
                    OutlinedTextField(
                        value = content,
                        onValueChange = { if (it.length <= 280) content = it },
                        placeholder = { Text("Descrição", color = Color.Gray) },
                        modifier = Modifier.fillMaxWidth().height(140.dp),
                        colors = textFieldColors(),
                        shape = RoundedCornerShape(12.dp),
                        maxLines = 6,
                    )

                    Text(
                        "${content.length}/280",
                        color = if (content.length > 250) PulsarCyan else Color.Gray,
                        fontSize = 12.sp,
                    )

                    // Botões de mídia
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { imagePicker.launch("image/*") },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = if (displayImage != null) PulsarCyan else Color.Gray,
                            ),
                            border = BorderStroke(1.dp, if (displayImage != null) PulsarCyan else PulsarGray),
                            modifier = Modifier.weight(1f),
                        ) {
                            Icon(Icons.Default.Image, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(if (displayImage != null) "Trocar imagem" else "Imagem", fontSize = 13.sp)
                        }
                        OutlinedButton(
                            onClick = { videoPicker.launch("video/*") },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = if (hasVideo) PulsarCyan else Color.Gray,
                            ),
                            border = BorderStroke(1.dp, if (hasVideo) PulsarCyan else PulsarGray),
                            modifier = Modifier.weight(1f),
                        ) {
                            Icon(Icons.Default.Videocam, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(if (hasVideo) "Trocar vídeo" else "Vídeo", fontSize = 13.sp)
                        }
                    }

                    // Preview da imagem (atual ou nova)
                    displayImage?.let { model ->
                        Box {
                            AsyncImage(
                                model = model,
                                contentDescription = "Preview",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(180.dp)
                                    .clip(RoundedCornerShape(12.dp)),
                            )
                            IconButton(
                                onClick = { newImageUri = null; removeImage = true },
                                modifier = Modifier.align(Alignment.TopEnd).padding(4.dp),
                            ) {
                                Icon(Icons.Default.Close, contentDescription = "Remover imagem", tint = Color.White)
                            }
                        }
                    }

                    // Indicador de vídeo
                    if (hasVideo) {
                        Surface(shape = RoundedCornerShape(12.dp), color = Color(0xFF1E1E1E)) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Icon(Icons.Default.Videocam, contentDescription = null, tint = PulsarCyan, modifier = Modifier.size(20.dp))
                                    Text(
                                        if (newVideoUri != null) "Novo vídeo selecionado" else "Vídeo atual",
                                        color = Color.White, fontSize = 13.sp,
                                    )
                                }
                                IconButton(
                                    onClick = { newVideoUri = null; removeVideo = true },
                                    modifier = Modifier.size(24.dp),
                                ) {
                                    Icon(Icons.Default.Close, contentDescription = "Remover vídeo", tint = Color.Gray, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }

                    if (loading && uploadProgress > 0f && uploadProgress < 1f) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            LinearProgressIndicator(
                                progress = { uploadProgress },
                                modifier = Modifier.fillMaxWidth(),
                                color = PulsarCyan,
                                trackColor = PulsarGray,
                            )
                            Text(
                                "Enviando mídia... ${(uploadProgress * 100).toInt()}%",
                                color = PulsarCyan, fontSize = 11.sp,
                            )
                        }
                    }

                    if (error != null) {
                        Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                    }
                }

                // Footer: ações
                Surface(color = PulsarSurface, shadowElevation = 8.dp) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        OutlinedButton(
                            onClick = onDismiss,
                            enabled = !loading,
                            modifier = Modifier.weight(1f).height(48.dp),
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, PulsarGray),
                        ) {
                            Text("Cancelar", color = Color.White)
                        }
                        Button(
                            onClick = {
                                viewModel.updatePost(
                                    postId      = post.id,
                                    title       = if (title.trim() != post.title) title.trim() else null,
                                    content     = if (content.trim() != post.content) content.trim() else null,
                                    newImageUri = newImageUri,
                                    removeImage = removeImage && newImageUri == null,
                                    newVideoUri = newVideoUri,
                                    removeVideo = removeVideo && newVideoUri == null,
                                )
                            },
                            enabled = !loading && content.isNotBlank() && isDirty,
                            modifier = Modifier.weight(1f).height(48.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PulsarCyan),
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            if (loading) {
                                CircularProgressIndicator(color = PulsarBackground, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Salvar", color = PulsarBackground, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun textFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor   = PulsarCyan,
    unfocusedBorderColor = PulsarGray,
    focusedTextColor     = Color.White,
    unfocusedTextColor   = Color.White,
    cursorColor          = PulsarCyan,
)
