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
        bat 'docker compose --env-file "%DOCKER_ENV_FILE%" up -d'
      }
    }

    stage('Health Check') {
      steps {
        bat 'powershell -NoProfile -Command "Start-Sleep -Seconds 10; Invoke-RestMethod http://localhost:3000/health | ConvertTo-Json"'
        bat 'powershell -NoProfile -Command "Invoke-RestMethod http://localhost:4200/api/health | ConvertTo-Json"'
      }
    }
  }
}
