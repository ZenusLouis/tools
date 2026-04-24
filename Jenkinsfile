pipeline {
    agent {
        kubernetes {
            yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    command: ['sleep']
    args: ['99d']
    resources:
      requests:
        memory: "2Gi"
        cpu: "1"
      limits:
        memory: "4Gi"
        cpu: "2"

  - name: git-tool
    image: alpine/git:latest
    command: ['sleep']
    args: ['99d']
"""
        }
    }

    environment {
        APP_IMAGE    = "ghcr.io/zenuslouis/gcs-dashboard"
        GHCR_CREDS   = "ghcr-creds"
        GITOPS_REPO  = "github.com/ZenusLouis/my-cluster-gitops.git"
        GITOPS_CREDS = "github-token"
        VALUES_PATH  = "global-claude-skills/values.yaml"
    }

    stages {
        stage('Build & Push Image') {
            steps {
                container('kaniko') {
                    withCredentials([usernamePassword(
                        credentialsId: "${GHCR_CREDS}",
                        usernameVariable: 'REG_USER',
                        passwordVariable: 'REG_PASS'
                    )]) {
                        sh '''
                            mkdir -p /kaniko/.docker
                            AUTH=$(echo -n "$REG_USER:$REG_PASS" | base64 -w 0)
                            printf '{"auths":{"ghcr.io":{"auth":"%s"}}}' "$AUTH" > /kaniko/.docker/config.json
                        '''

                        sh '''
                            /kaniko/executor \
                                --context "$WORKSPACE/apps/dashboard" \
                                --dockerfile "$WORKSPACE/apps/dashboard/Dockerfile" \
                                --destination "$APP_IMAGE:$BUILD_ID" \
                                --destination "$APP_IMAGE:latest" \
                                --snapshot-mode=redo \
                                --compressed-caching=false
                        '''
                    }
                }
            }
        }

        stage('Update GitOps Manifest') {
            steps {
                container('git-tool') {
                    withCredentials([usernamePassword(
                        credentialsId: "${GITOPS_CREDS}",
                        usernameVariable: 'GIT_USER',
                        passwordVariable: 'GIT_PASS'
                    )]) {
                        sh '''
                            git clone https://$GIT_USER:$GIT_PASS@$GITOPS_REPO gitops-repo
                        '''

                        sh '''
                            VALUES="gitops-repo/$VALUES_PATH"

                            if [ ! -f "$VALUES" ]; then
                                echo "ERROR: $VALUES not found"
                                exit 1
                            fi

                            sed -i "s|^  tag:.*|  tag: \\"$BUILD_ID\\"|" "$VALUES"

                            echo "--- values.yaml sau khi update ---"
                            cat "$VALUES"
                        '''

                        sh '''
                            cd gitops-repo
                            git config user.email 'jenkins@gcs.local'
                            git config user.name  'Jenkins CI'
                            git add "$VALUES_PATH"
                            git diff --cached --quiet && echo "No changes" && exit 0
                            git commit -m "ci: bump gcs-dashboard to build $BUILD_ID"
                            git push
                        '''
                    }
                }
            }
        }
    }

    post {
        success {
            echo "=============================================================="
            echo "Pipeline SUCCEEDED  |  Build: ${BUILD_ID}"
            echo "Image pushed: ${APP_IMAGE}:${BUILD_ID}"
            echo "Argo CD will sync from: ${VALUES_PATH}"
            echo "=============================================================="
        }
        failure {
            echo "=============================================================="
            echo "Pipeline FAILED  |  Build: ${BUILD_ID}"
            echo "GitOps repo was NOT updated."
            echo "=============================================================="
        }
        always {
            cleanWs()
        }
    }
}