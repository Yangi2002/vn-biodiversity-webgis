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
      if (fileExists(env.DOCKER_ENV_FILE)) {
        echo "${env.DOCKER_ENV_FILE} already exists in workspace."
      } else {
        withCredentials([file(credentialsId: 'vn-biodiversity-env-docker', variable: 'ENV_DOCKER_FILE')]) {
          bat 'copy /Y "%ENV_DOCKER_FILE%" "%DOCKER_ENV_FILE%"'
        }
      }

      bat 'copy /Y "%DOCKER_ENV_FILE%" "%API_DIR%\\.env"'
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

    stage('Deploy') {
      steps {
        bat 'docker compose --env-file "%DOCKER_ENV_FILE%" down --remove-orphans'
        bat 'docker rm -f vn-biodiversity-api vn-biodiversity-ui vn-biodiversity-db 2>NUL || ver >NUL'
        bat 'docker compose --env-file "%DOCKER_ENV_FILE%" up -d --force-recreate --remove-orphans'
      }
    }

    stage('Health Check') {
      steps {
        bat '''
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; for ($i = 1; $i -le 40; $i++) { try { Write-Host ('API health attempt ' + $i); Invoke-RestMethod http://localhost:3000/health | ConvertTo-Json; exit 0 } catch { Write-Host ('API not ready: ' + $_.Exception.Message); Start-Sleep -Seconds 3 } }; docker ps -a --filter name=vn-biodiversity; docker logs --tail 120 vn-biodiversity-api; exit 1"
        '''
        bat '''
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; for ($i = 1; $i -le 40; $i++) { try { Write-Host ('UI health attempt ' + $i); Invoke-RestMethod http://localhost:4200/api/health | ConvertTo-Json; exit 0 } catch { Write-Host ('UI not ready: ' + $_.Exception.Message); Start-Sleep -Seconds 3 } }; docker ps -a --filter name=vn-biodiversity; docker logs --tail 120 vn-biodiversity-ui; exit 1"
        '''
      }
    }
  }
}
