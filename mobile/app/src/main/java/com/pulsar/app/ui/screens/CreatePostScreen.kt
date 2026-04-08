package com.pulsar.app.ui.screens

import android.Manifest
import android.annotation.SuppressLint
import android.location.Location
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.android.gms.location.LocationServices
import com.pulsar.app.ui.theme.PulsarBackground
import com.pulsar.app.ui.theme.PulsarCyan
import com.pulsar.app.ui.theme.PulsarGray
import com.pulsar.app.ui.theme.PulsarSurface
import com.pulsar.app.viewmodel.PostViewModel

@SuppressLint("MissingPermission")
@Composable
fun CreatePostScreen(
    viewModel: PostViewModel,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }

    var content by remember { mutableStateOf("") }
    var location by remember { mutableStateOf<Location?>(null) }
    var locationError by remember { mutableStateOf<String?>(null) }

    val loading by viewModel.loading.collectAsState()
    val error by viewModel.error.collectAsState()
    val postSuccess by viewModel.postSuccess.collectAsState()

    LaunchedEffect(Unit) {
        fusedLocationClient.lastLocation.addOnSuccessListener { loc ->
            if (loc != null) location = loc
            else locationError = "Localização indisponível. Verifique as permissões."
        }.addOnFailureListener {
            locationError = "Erro ao obter localização: ${it.message}"
        }
    }

    LaunchedEffect(postSuccess) {
        if (postSuccess) {
            viewModel.resetPostSuccess()
            onBack()
        }
    }

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
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar", tint = Color.White)
                }
                Text(
                    text = "Novo Pulso",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Location card
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = PulsarSurface,
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text("📍", fontSize = 20.sp)
                        if (location != null) {
                            Column {
                                Text("Localização capturada", color = PulsarCyan, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                Text(
                                    "${"%.5f".format(location!!.latitude)}, ${"%.5f".format(location!!.longitude)}",
                                    color = Color.Gray,
                                    fontSize = 11.sp
                                )
                            }
                        } else if (locationError != null) {
                            Text(locationError!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                        } else {
                            Text("Obtendo localização...", color = Color.Gray, fontSize = 13.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = PulsarCyan,
                                strokeWidth = 2.dp
                            )
                        }
                    }
                }

                // Content field
                OutlinedTextField(
                    value = content,
                    onValueChange = { if (it.length <= 280) content = it },
                    placeholder = { Text("O que está acontecendo perto de você?", color = Color.Gray) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PulsarCyan,
                        unfocusedBorderColor = PulsarGray,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        cursorColor = PulsarCyan,
                    ),
                    shape = RoundedCornerShape(12.dp),
                    maxLines = 6,
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${content.length}/280",
                        color = if (content.length > 250) PulsarCyan else Color.Gray,
                        fontSize = 12.sp
                    )
                    Text("Expira em 6 horas", color = Color(0xFF555555), fontSize = 12.sp)
                }

                if (error != null) {
                    Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                }

                Button(
                    onClick = {
                        val loc = location ?: return@Button
                        viewModel.createPost(content.trim(), loc.latitude, loc.longitude)
                    },
                    enabled = content.isNotBlank() && location != null && !loading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PulsarCyan),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    if (loading) {
                        CircularProgressIndicator(
                            color = PulsarBackground,
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            "Publicar Pulso",
                            color = PulsarBackground,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    }
}
