plugins {
    id("java")
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