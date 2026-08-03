pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  environment {
    UI_DIR = 'vn-biodiversity-webgis-UI'
    API_DIR = 'vn-biodiversity-webgis-API'
    DOCKER_ENV_FILE = '.env.docker'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Prepare Docker Env') {
      steps {
        script {
          withCredentials([file(credentialsId: 'vn-biodiversity-env-docker', variable: 'ENV_DOCKER_FILE')]) {
            bat 'copy /Y "%ENV_DOCKER_FILE%" "%DOCKER_ENV_FILE%"'
          }

          bat 'copy /Y "%DOCKER_ENV_FILE%" "%API_DIR%\\.env"'

          def dockerEnvMap = [:]
          readFile(env.DOCKER_ENV_FILE).split(/\r?\n/).each { line ->
            def trimmed = line.trim()
            if (trimmed && !trimmed.startsWith('#') && trimmed.contains('=')) {
              def separatorIndex = trimmed.indexOf('=')
              def key = trimmed.substring(0, separatorIndex)
              def value = trimmed.substring(separatorIndex + 1)
              dockerEnvMap[key] = value
            }
          }

          env.PROD_HOST = dockerEnvMap['PROD_HOST']
          env.PROD_USER = dockerEnvMap['PROD_USER']
          env.PROD_APP_DIR = dockerEnvMap['PROD_APP_DIR']

          if (!env.PROD_HOST || !env.PROD_USER || !env.PROD_APP_DIR) {
            error 'PROD_HOST, PROD_USER, or PROD_APP_DIR is missing in .env.docker Jenkins credential.'
          }

          echo "Production target: ${env.PROD_USER}@${env.PROD_HOST}:${env.PROD_APP_DIR}"

          bat '''
          powershell -NoProfile -ExecutionPolicy Bypass -Command "$envLine = Get-Content $env:DOCKER_ENV_FILE | Where-Object { $_ -like 'DATABASE_URL=*' } | Select-Object -First 1; if (-not $envLine) { throw 'DATABASE_URL is missing in .env.docker' }; $safe = $envLine -replace '://([^:]+):([^@]+)@', '://$1:***@'; Write-Host $safe"
          '''
        }
      }
    }

    stage('Frontend Build') {
      steps {
        dir("${UI_DIR}") {
          bat 'npm ci'
          bat 'npm run build'
        }
      }
    }

    stage('Backend Build') {
      steps {
        dir("${API_DIR}") {
          bat 'npm ci'
          bat 'npm run prisma:generate'
          bat 'npm run build'
        }
      }
    }

    stage('Backend Test') {
      steps {
        dir("${API_DIR}") {
          bat 'npm test -- --runInBand'
        }
      }
    }

    stage('Docker Build') {
      steps {
        bat 'docker compose --env-file "%DOCKER_ENV_FILE%" build'
      }
    }

    stage('Approve Production Deploy') {
      steps {
        input message: 'Deploy this build to production server?', ok: 'Deploy'
      }
    }

    stage('Deploy Production Server') {
      steps {
        sshagent(credentials: ['vn-biodiversity-prod-ssh']) {
          bat 'ssh -o StrictHostKeyChecking=no %PROD_USER%@%PROD_HOST% "cd %PROD_APP_DIR% && git pull origin main && docker compose --env-file .env.docker build api frontend && docker compose --env-file .env.docker up -d api frontend && docker compose --env-file .env.docker ps"'
        }
      }
    }

    stage('Production Health Check') {
      steps {
        bat '''
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; for ($i = 1; $i -le 40; $i++) { try { Write-Host ('Production API health attempt ' + $i); Invoke-RestMethod http://%PROD_HOST%:3000/health | ConvertTo-Json; exit 0 } catch { Write-Host ('Production API not ready: ' + $_.Exception.Message); Start-Sleep -Seconds 3 } }; exit 1"
        '''
        bat '''
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; for ($i = 1; $i -le 40; $i++) { try { Write-Host ('Production UI health attempt ' + $i); Invoke-RestMethod http://%PROD_HOST%:4200/api/health | ConvertTo-Json; exit 0 } catch { Write-Host ('Production UI not ready: ' + $_.Exception.Message); Start-Sleep -Seconds 3 } }; exit 1"
        '''
      }
    }
  }
}
