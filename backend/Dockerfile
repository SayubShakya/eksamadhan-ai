# The backend as one container (project packaging): built from source, then run on a small Java
# runtime. Settings come from backend/.env, mounted at /app/.env by docker-compose.yml.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests && cp target/*.jar /src/app.jar

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/app.jar /app/app.jar
# Uploaded pictures and voice notes are kept here (a volume in docker-compose.yml).
RUN mkdir -p /app/media
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
