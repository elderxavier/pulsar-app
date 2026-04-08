package com.pulsar.app

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.core.view.WindowCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.pulsar.app.ui.screens.CreatePostScreen
import com.pulsar.app.ui.screens.LoginScreen
import com.pulsar.app.ui.screens.MapScreen
import com.pulsar.app.ui.theme.PulsarTheme
import com.pulsar.app.viewmodel.AuthViewModel
import com.pulsar.app.viewmodel.PostViewModel

class MainActivity : ComponentActivity() {

    private val locationPermissionRequest = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* handled in screens */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WindowCompat.setDecorFitsSystemWindows(window, false)

        locationPermissionRequest.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )

        setContent {
            PulsarTheme {
                PulsarApp()
            }
        }
    }
}

@Composable
fun PulsarApp() {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = viewModel()
    val postViewModel: PostViewModel = viewModel()
    val user by authViewModel.user.collectAsState()

    val startDestination = if (user != null) "map" else "login"

    NavHost(navController = navController, startDestination = startDestination) {
        composable("login") {
            LoginScreen(viewModel = authViewModel)

            LaunchedEffect(user) {
                if (user != null) navController.navigate("map") {
                    popUpTo("login") { inclusive = true }
                }
            }
        }

        composable("map") {
            LaunchedEffect(user) {
                if (user == null) navController.navigate("login") {
                    popUpTo("map") { inclusive = true }
                }
            }
            MapScreen(
                authViewModel = authViewModel,
                postViewModel = postViewModel,
                onCreatePost = { navController.navigate("create_post") }
            )
        }

        composable("create_post") {
            CreatePostScreen(
                viewModel = postViewModel,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
