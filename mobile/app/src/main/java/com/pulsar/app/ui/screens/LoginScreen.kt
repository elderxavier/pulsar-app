package com.pulsar.app.ui.screens

import android.app.Activity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.pulsar.app.R
import com.pulsar.app.ui.theme.PulsarBackground
import com.pulsar.app.ui.theme.PulsarCyan
import com.pulsar.app.ui.theme.PulsarGray
import com.pulsar.app.viewmodel.AuthViewModel

@Composable
fun LoginScreen(viewModel: AuthViewModel) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isRegister by remember { mutableStateOf(false) }
    var googleError by remember { mutableStateOf<String?>(null) }

    val loading by viewModel.loading.collectAsState()
    val error by viewModel.error.collectAsState()
    val context = LocalContext.current

    val googleSignInClient = remember {
        val webClientId = context.getString(R.string.google_web_client_id)
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(webClientId)
            .requestEmail()
            .build()
        GoogleSignIn.getClient(context, gso)
    }

    val googleLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            try {
                val account = GoogleSignIn.getSignedInAccountFromIntent(result.data)
                    .getResult(ApiException::class.java)
                val idToken = account.idToken
                if (idToken != null) {
                    viewModel.signInWithGoogle(idToken)
                } else {
                    googleError = "Token Google não recebido. Tente novamente."
                }
            } catch (e: ApiException) {
                googleError = "Erro Google (${e.statusCode}): ${e.message}"
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(PulsarBackground),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "PULSAR",
                fontSize = 40.sp,
                fontWeight = FontWeight.Bold,
                color = PulsarCyan,
                letterSpacing = 8.sp
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = "O radar do agora", fontSize = 14.sp, color = Color.Gray)

            Spacer(modifier = Modifier.height(48.dp))

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                color = Color(0xFF1A1A1A),
                tonalElevation = 4.dp
            ) {
                Column(modifier = Modifier.padding(24.dp)) {
                    Text(
                        text = if (isRegister) "Criar conta" else "Entrar",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(24.dp))

                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Email") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = PulsarCyan,
                            focusedLabelColor = PulsarCyan,
                            cursorColor = PulsarCyan,
                            unfocusedBorderColor = PulsarGray,
                            unfocusedTextColor = Color.White,
                            focusedTextColor = Color.White,
                        )
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Senha") },
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = PulsarCyan,
                            focusedLabelColor = PulsarCyan,
                            cursorColor = PulsarCyan,
                            unfocusedBorderColor = PulsarGray,
                            unfocusedTextColor = Color.White,
                            focusedTextColor = Color.White,
                        )
                    )

                    val displayError = error ?: googleError
                    if (displayError != null) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = displayError,
                            color = MaterialTheme.colorScheme.error,
                            fontSize = 13.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    val isFormValid = email.contains('@') && email.contains('.') &&
                        password.length >= 6

                    Button(
                        onClick = {
                            if (isRegister) viewModel.register(email.trim(), password)
                            else viewModel.login(email.trim(), password)
                        },
                        enabled = !loading && isFormValid,
                        modifier = Modifier.fillMaxWidth().height(50.dp),
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
                                text = if (isRegister) "Criar conta" else "Entrar",
                                color = PulsarBackground,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    TextButton(
                        onClick = {
                            isRegister = !isRegister
                            viewModel.clearError()
                            googleError = null
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = if (isRegister) "Já tem conta? Entrar" else "Não tem conta? Criar conta",
                            color = PulsarCyan,
                            fontSize = 14.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HorizontalDivider(modifier = Modifier.weight(1f), color = Color(0xFF333333))
                Text(text = "  ou  ", color = Color(0xFF666666), fontSize = 13.sp)
                HorizontalDivider(modifier = Modifier.weight(1f), color = Color(0xFF333333))
            }

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedButton(
                onClick = {
                    googleError = null
                    googleSignInClient.signOut().addOnCompleteListener {
                        googleLauncher.launch(googleSignInClient.signInIntent)
                    }
                },
                enabled = !loading,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = Color(0xFF1A1A1A),
                    contentColor = Color.White
                ),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF444444))
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    GoogleIconCanvas()
                    Text(
                        text = "Continuar com Google",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White
                    )
                }
            }
        }
    }
}

@Composable
private fun GoogleIconCanvas() {
    androidx.compose.foundation.Canvas(modifier = Modifier.size(20.dp)) {
        val r = size.minDimension / 2f
        val cx = size.width / 2f
        val cy = size.height / 2f
        drawCircle(color = androidx.compose.ui.graphics.Color.White, radius = r)
        val sz = androidx.compose.ui.geometry.Size(r * 2, r * 2)
        val tl = androidx.compose.ui.geometry.Offset(cx - r, cy - r)
        drawArc(color = androidx.compose.ui.graphics.Color(0xFF4285F4), startAngle = -30f,  sweepAngle = 120f, useCenter = true, size = sz, topLeft = tl)
        drawArc(color = androidx.compose.ui.graphics.Color(0xFF34A853), startAngle = 90f,   sweepAngle = 90f,  useCenter = true, size = sz, topLeft = tl)
        drawArc(color = androidx.compose.ui.graphics.Color(0xFFFBBC05), startAngle = 180f,  sweepAngle = 90f,  useCenter = true, size = sz, topLeft = tl)
        drawArc(color = androidx.compose.ui.graphics.Color(0xFFEA4335), startAngle = 270f,  sweepAngle = 60f,  useCenter = true, size = sz, topLeft = tl)
        drawCircle(color = androidx.compose.ui.graphics.Color.White, radius = r * 0.55f)
    }
}
