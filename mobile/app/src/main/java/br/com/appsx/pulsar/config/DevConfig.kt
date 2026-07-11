package br.com.appsx.pulsar.config

/**
 * DEV ONLY: flags para desenvolvimento. NÃO ativar em release.
 *
 * BYPASS_AUTH: pula a tela de login fazendo sign-in anônimo automático
 * no Firebase. Requer "Anonymous" habilitado em Firebase Authentication.
 */
object DevConfig {
    const val BYPASS_AUTH: Boolean = false
}
