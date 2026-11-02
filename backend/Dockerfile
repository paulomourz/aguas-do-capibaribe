# Estágio de build: compila a API com Maven (os testes rodam no CI).
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src src
RUN mvn -B -q -DskipTests package

# Estágio final: só o JRE e o jar, sem usuário root.
FROM eclipse-temurin:25-jre
RUN useradd --system aguas
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
USER aguas
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
