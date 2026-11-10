# Estágio de build: compila a API com Maven (os testes rodam no CI) e o healthcheck do contêiner.
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src src
RUN mvn -B -q -DskipTests package
COPY docker/Saude.java docker/
RUN javac -d saude docker/Saude.java

# Estágio final: imagem distroless, só com o Java 25 (JRE) e o jar. Sem shell, sem gerenciador de pacotes e sem
# usuário root (usuário nonroot, uid 65532), o que reduz o que um invasor poderia usar dentro do contêiner.
# A versão fica presa pelo digest; para atualizar, pegue o digest novo da tag "nonroot".
FROM gcr.io/distroless/java25-debian13:nonroot@sha256:8ac5525549d14b8ddd34562f9fc8e6ba4840c995363a1507b17cadf8bb7ab57e
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
COPY --from=build /build/saude saude
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
