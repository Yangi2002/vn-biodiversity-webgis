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
          withCredentials([
            file(
              credentialsId: 'vn-biodiversity-env-docker',
              variable: 'ENV_DOCKER_FILE'
            )
          ]) {
            bat 'copy /Y "%ENV_DOCKER_FILE%" "%DOCKER_ENV_FILE%"'
          }

          bat 'copy /Y "%DOCKER_ENV_FILE%" "%API_DIR%\\.env"'

          def dockerEnvMap = [:]

          readFile(env.DOCKER_ENV_FILE)
            .split(/\r?\n/)
            .each { line ->
              def trimmed = line.trim()

              if (
                trimmed &&
                !trimmed.startsWith('#') &&
                trimmed.contains('=')
              ) {
                def separatorIndex = trimmed.indexOf('=')

                def key = trimmed
                  .substring(0, separatorIndex)
                  .replace('\uFEFF', '')
                  .trim()

                def value = trimmed
                  .substring(separatorIndex + 1)
                  .trim()

                dockerEnvMap[key] = value
              }
            }

          def requireDockerEnv = { key ->
            def value = dockerEnvMap[key]?.trim()

            if (!value || value.equalsIgnoreCase('null')) {
              error "${key} is missing or empty in ${env.DOCKER_ENV_FILE}. Update Jenkins credential vn-biodiversity-env-docker."
            }

            return value
          }

          requireDockerEnv('DATABASE_URL')
          env.PROD_HOST = requireDockerEnv('PROD_HOST')
          env.PROD_USER = requireDockerEnv('PROD_USER')
          env.PROD_APP_DIR = requireDockerEnv('PROD_APP_DIR')

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
        withCredentials([
          string(
            credentialsId: 'vn-biodiversity-prod-ssh-key-b64',
            variable: 'PROD_SSH_KEY_B64'
          )
        ]) {
          bat '''
          @echo off
          setlocal

          set "PROD_KEY_FILE=%WORKSPACE%\\.jenkins-prod-key-%BUILD_NUMBER%"

          if exist "%PROD_KEY_FILE%" (
            del /F /Q "%PROD_KEY_FILE%"
          )

          powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [IO.File]::WriteAllBytes($env:PROD_KEY_FILE, [Convert]::FromBase64String($env:PROD_SSH_KEY_B64))"

          if errorlevel 1 exit /b 1

          icacls "%PROD_KEY_FILE%" /inheritance:r

          if errorlevel 1 exit /b 1

          for /F "delims=" %%A in ('whoami') do set "JENKINS_ACCOUNT=%%A"

          echo Jenkins Windows account: %JENKINS_ACCOUNT%

          icacls "%PROD_KEY_FILE%" /grant:r "%JENKINS_ACCOUNT%:R"

          if errorlevel 1 exit /b 1

          ssh-keygen -y -f "%PROD_KEY_FILE%" >NUL

          if errorlevel 1 exit /b 1

          ssh ^
            -i "%PROD_KEY_FILE%" ^
            -o StrictHostKeyChecking=no ^
            %PROD_USER%@%PROD_HOST% ^
            "cd %PROD_APP_DIR% && git pull origin main && docker compose --env-file .env.docker build api frontend && docker compose --env-file .env.docker up -d api frontend && docker compose --env-file .env.docker ps"

          set "SSH_EXIT=%ERRORLEVEL%"

          del /F /Q "%PROD_KEY_FILE%"

          exit /b %SSH_EXIT%
          '''
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