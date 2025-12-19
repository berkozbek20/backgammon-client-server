plugins {
    id("java")
    id("com.github.johnrengelman.shadow") version "8.1.1"
}

// Shadow plugin will create a runnable fat-jar (build/libs/*all.jar)

import com.github.jengelman.gradle.plugins.shadow.tasks.ShadowJar

// Ensure the shadowJar produces a jar with correct Main-Class
tasks.withType<ShadowJar> {
    archiveBaseName.set("tavla-server")
    manifest {
        attributes["Main-Class"] = "com.tavla.server.ws.TavlaWebSocketServer"
    }
}

group = "com.tavla"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {

    implementation("org.java-websocket:Java-WebSocket:1.5.6")

    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.2")

    testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")


}


tasks.test {
    useJUnitPlatform()
}