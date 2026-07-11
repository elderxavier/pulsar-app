package br.com.appsx.pulsar.ui.screens

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.firebase.Timestamp
import br.com.appsx.pulsar.ui.theme.PulsarBackground
import br.com.appsx.pulsar.ui.theme.PulsarCyan
import br.com.appsx.pulsar.ui.theme.PulsarGray
import br.com.appsx.pulsar.ui.theme.PulsarSurface
import br.com.appsx.pulsar.viewmodel.PostViewModel
import java.text.SimpleDateFormat
import java.util.*

@SuppressLint("MissingPermission")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreatePostScreen(
    viewModel: PostViewModel,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }

    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var location by remember { mutableStateOf<Location?>(null) }
    var locationError by remember { mutableStateOf<String?>(null) }

    // Timestamps: padrão início = agora, fim = agora + 6h
    val defaultStart = remember { Calendar.getInstance() }
    val defaultEnd = remember { Calendar.getInstance().apply { add(Calendar.HOUR_OF_DAY, 6) } }
    var startsAt by remember { mutableStateOf(defaultStart) }
    var expiresAt by remember { mutableStateOf(defaultEnd) }

    var showStartDatePicker by remember { mutableStateOf(false) }
    var showStartTimePicker by remember { mutableStateOf(false) }
    var showEndDatePicker by remember { mutableStateOf(false) }
    var showEndTimePicker by remember { mutableStateOf(false) }

    var imageUri by remember { mutableStateOf<Uri?>(null) }
    var videoUri by remember { mutableStateOf<Uri?>(null) }

    val imagePickerLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri -> if (uri != null) { imageUri = uri; videoUri = null } }

    val videoPickerLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri -> if (uri != null) { videoUri = uri; imageUri = null } }

    val loading by viewModel.loading.collectAsState()
    val error by viewModel.error.collectAsState()
    val postSuccess by viewModel.postSuccess.collectAsState()
    val uploadProgress by viewModel.uploadProgress.collectAsState()

    val dateFmt = remember { SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()) }
    val timeFmt = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

    DisposableEffect(Unit) {
        val cts = CancellationTokenSource()
        fusedLocationClient
            .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
            .addOnSuccessListener { loc ->
                if (loc != null) {
                    location = loc
                } else {
                    val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
                    val gps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                        ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                    if (gps != null) location = gps
                    else locationError = "Localização indisponível. Verifique as permissões de GPS."
                }
            }
            .addOnFailureListener {
                locationError = "Erro ao obter localização: ${it.message}"
            }
        onDispose { cts.cancel() }
    }

    LaunchedEffect(postSuccess) {
        if (postSuccess) {
            viewModel.resetPostSuccess()
            onBack()
        }
    }

    // Date/Time pickers
    if (showStartDatePicker) {
        val picker = DatePickerState(
            initialSelectedDateMillis = startsAt.timeInMillis,
            locale = CalendarLocale.getDefault()
        )
        DatePickerDialog(
            onDismissRequest = { showStartDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    picker.selectedDateMillis?.let { millis ->
                        startsAt = (startsAt.clone() as Calendar).apply {
                            timeInMillis = millis
                            set(Calendar.HOUR_OF_DAY, startsAt.get(Calendar.HOUR_OF_DAY))
                            set(Calendar.MINUTE, startsAt.get(Calendar.MINUTE))
                        }
                    }
                    showStartDatePicker = false
                    showStartTimePicker = true
                }) { Text("OK", color = PulsarCyan) }
            },
            dismissButton = { TextButton(onClick = { showStartDatePicker = false }) { Text("Cancelar") } }
        ) { DatePicker(state = picker) }
    }

    if (showStartTimePicker) {
        val picker = TimePickerState(
            initialHour = startsAt.get(Calendar.HOUR_OF_DAY),
            initialMinute = startsAt.get(Calendar.MINUTE),
            is24Hour = true
        )
        AlertDialog(
            onDismissRequest = { showStartTimePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    startsAt = (startsAt.clone() as Calendar).apply {
                        set(Calendar.HOUR_OF_DAY, picker.hour)
                        set(Calendar.MINUTE, picker.minute)
                    }
                    showStartTimePicker = false
                }) { Text("OK", color = PulsarCyan) }
            },
            dismissButton = { TextButton(onClick = { showStartTimePicker = false }) { Text("Cancelar") } },
            title = { Text("Hora de início") },
            text = { TimePicker(state = picker) },
            containerColor = Color(0xFF1A1A1A)
        )
    }

    if (showEndDatePicker) {
        val picker = DatePickerState(
            initialSelectedDateMillis = expiresAt.timeInMillis,
            locale = CalendarLocale.getDefault()
        )
        DatePickerDialog(
            onDismissRequest = { showEndDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    picker.selectedDateMillis?.let { millis ->
                        expiresAt = (expiresAt.clone() as Calendar).apply {
                            timeInMillis = millis
                            set(Calendar.HOUR_OF_DAY, expiresAt.get(Calendar.HOUR_OF_DAY))
                            set(Calendar.MINUTE, expiresAt.get(Calendar.MINUTE))
                        }
                    }
                    showEndDatePicker = false
                    showEndTimePicker = true
                }) { Text("OK", color = PulsarCyan) }
            },
            dismissButton = { TextButton(onClick = { showEndDatePicker = false }) { Text("Cancelar") } }
        ) { DatePicker(state = picker) }
    }

    if (showEndTimePicker) {
        val picker = TimePickerState(
            initialHour = expiresAt.get(Calendar.HOUR_OF_DAY),
            initialMinute = expiresAt.get(Calendar.MINUTE),
            is24Hour = true
        )
        AlertDialog(
            onDismissRequest = { showEndTimePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    expiresAt = (expiresAt.clone() as Calendar).apply {
                        set(Calendar.HOUR_OF_DAY, picker.hour)
                        set(Calendar.MINUTE, picker.minute)
                    }
                    showEndTimePicker = false
                }) { Text("OK", color = PulsarCyan) }
            },
            dismissButton = { TextButton(onClick = { showEndTimePicker = false }) { Text("Cancelar") } },
            title = { Text("Hora de encerramento") },
            text = { TimePicker(state = picker) },
            containerColor = Color(0xFF1A1A1A)
        )
    }

    val durationHours = ((expiresAt.timeInMillis - startsAt.timeInMillis) / 3_600_000f)
    val durationLabel = when {
        durationHours < 1f -> "${((durationHours * 60).toInt())} min"
        durationHours % 1f == 0f -> "${durationHours.toInt()}h"
        else -> "${"%.1f".format(durationHours)}h"
    }
    val isValidDuration = expiresAt.after(startsAt)

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
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Localização
                Surface(shape = RoundedCornerShape(12.dp), color = PulsarSurface) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text("📍", fontSize = 20.sp)
                        if (location != null) {
                            Column {
                                Text("Localização capturada", color = PulsarCyan, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                Text(
                                    "${"%.5f".format(location!!.latitude)}, ${"%.5f".format(location!!.longitude)}",
                                    color = Color.Gray, fontSize = 11.sp
                                )
                            }
                        } else if (locationError != null) {
                            Text(locationError!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                        } else {
                            Text("Obtendo localização...", color = Color.Gray, fontSize = 13.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = PulsarCyan, strokeWidth = 2.dp)
                        }
                    }
                }

                // Período
                Surface(shape = RoundedCornerShape(12.dp), color = PulsarSurface) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Default.Schedule, contentDescription = null, tint = PulsarCyan, modifier = Modifier.size(16.dp))
                            Text("Período do evento", color = PulsarCyan, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            Spacer(modifier = Modifier.weight(1f))
                            if (isValidDuration) {
                                Surface(shape = RoundedCornerShape(20.dp), color = PulsarCyan.copy(alpha = 0.15f)) {
                                    Text(
                                        "duração: $durationLabel",
                                        color = PulsarCyan, fontSize = 11.sp,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            // Início
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Início", color = Color.Gray, fontSize = 11.sp)
                                OutlinedButton(
                                    onClick = { showStartDatePicker = true },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, PulsarGray)
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(dateFmt.format(startsAt.time), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                        Text(timeFmt.format(startsAt.time), fontSize = 11.sp, color = PulsarCyan)
                                    }
                                }
                            }
                            // Fim
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Fim", color = Color.Gray, fontSize = 11.sp)
                                OutlinedButton(
                                    onClick = { showEndDatePicker = true },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, if (!isValidDuration) MaterialTheme.colorScheme.error else PulsarGray)
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(dateFmt.format(expiresAt.time), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                        Text(timeFmt.format(expiresAt.time), fontSize = 11.sp, color = if (!isValidDuration) MaterialTheme.colorScheme.error else PulsarCyan)
                                    }
                                }
                            }
                        }
                        if (!isValidDuration) {
                            Text("O fim deve ser após o início", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                        }
                    }
                }

                // Título
                OutlinedTextField(
                    value = title,
                    onValueChange = { if (it.length <= 100) title = it },
                    placeholder = { Text("Título do pulso", color = Color.Gray) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PulsarCyan,
                        unfocusedBorderColor = PulsarGray,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        cursorColor = PulsarCyan,
                    ),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true,
                )

                // Descrição
                OutlinedTextField(
                    value = content,
                    onValueChange = { if (it.length <= 280) content = it },
                    placeholder = { Text("Descrição — o que está acontecendo perto de você?", color = Color.Gray) },
                    modifier = Modifier.fillMaxWidth().height(140.dp),
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

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("${content.length}/280", color = if (content.length > 250) PulsarCyan else Color.Gray, fontSize = 12.sp)
                }

                // Mídia
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { imagePickerLauncher.launch("image/*") },
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = if (imageUri != null) PulsarCyan else Color.Gray),
                        border = androidx.compose.foundation.BorderStroke(1.dp, if (imageUri != null) PulsarCyan else PulsarGray),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Image, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Imagem", fontSize = 13.sp)
                    }
                    OutlinedButton(
                        onClick = { videoPickerLauncher.launch("video/*") },
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = if (videoUri != null) PulsarCyan else Color.Gray),
                        border = androidx.compose.foundation.BorderStroke(1.dp, if (videoUri != null) PulsarCyan else PulsarGray),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Videocam, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Vídeo", fontSize = 13.sp)
                    }
                }

                // Preview de mídia selecionada
                imageUri?.let { uri ->
                    Box {
                        AsyncImage(
                            model = uri,
                            contentDescription = "Preview",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                                .clip(RoundedCornerShape(12.dp))
                        )
                        IconButton(
                            onClick = { imageUri = null },
                            modifier = Modifier.align(Alignment.TopEnd).padding(4.dp)
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Remover", tint = Color.White)
                        }
                    }
                }

                videoUri?.let {
                    Surface(shape = RoundedCornerShape(12.dp), color = Color(0xFF1E1E1E)) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Default.Videocam, contentDescription = null, tint = PulsarCyan, modifier = Modifier.size(20.dp))
                                Text("Vídeo selecionado", color = Color.White, fontSize = 13.sp)
                            }
                            IconButton(onClick = { videoUri = null }, modifier = Modifier.size(24.dp)) {
                                Icon(Icons.Default.Close, contentDescription = "Remover", tint = Color.Gray, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }

                if (error != null) {
                    Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                }

                // Barra de progresso durante upload de mídia
                if (loading && uploadProgress > 0f && uploadProgress < 1f) {
                    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        LinearProgressIndicator(
                            progress = { uploadProgress },
                            modifier = Modifier.fillMaxWidth(),
                            color = PulsarCyan,
                            trackColor = PulsarGray,
                        )
                        Text(
                            "Enviando mídia... ${(uploadProgress * 100).toInt()}%",
                            color = PulsarCyan, fontSize = 11.sp
                        )
                    }
                }

                Button(
                    onClick = {
                        val loc = location ?: return@Button
                        viewModel.createPost(
                            title = title.trim(),
                            content = content.trim(),
                            latitude = loc.latitude,
                            longitude = loc.longitude,
                            startsAt = Timestamp(startsAt.time),
                            expiresAt = Timestamp(expiresAt.time),
                            imageUri = imageUri,
                            videoUri = videoUri,
                        )
                    },
                    enabled = content.isNotBlank() && location != null && !loading && isValidDuration,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PulsarCyan),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    if (loading) {
                        CircularProgressIndicator(color = PulsarBackground, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Publicar Pulso", color = PulsarBackground, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}
