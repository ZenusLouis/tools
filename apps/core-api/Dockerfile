FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY apps/core-api/pom.xml apps/core-api/pom.xml
WORKDIR /workspace/apps/core-api
RUN mvn -q -DskipTests dependency:go-offline
WORKDIR /workspace
COPY apps/core-api apps/core-api
WORKDIR /workspace/apps/core-api
RUN mvn -q package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /workspace/apps/core-api/target/gcs-core-api-*.jar /app/gcs-core-api.jar
EXPOSE 4000
ENTRYPOINT ["java", "-jar", "/app/gcs-core-api.jar"]
