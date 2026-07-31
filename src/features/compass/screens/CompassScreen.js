import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ImageBackground,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";

export default function CompassScreen({ onBack }) {
  const reveal = useRef(new Animated.Value(0)).current;
  const headingRotation = useRef(new Animated.Value(0)).current;
  const headingSubscription = useRef(null);
  const currentRotationRef = useRef(0);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState("locating");
  const [heading, setHeading] = useState(null);

  useEffect(() => {
    mountedRef.current = true;

    Animated.timing(reveal, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const handleHeading = (reading) => {
      const trueHeading = Number(reading?.trueHeading);
      const magneticHeading = Number(reading?.magHeading);
      const nextHeading =
        Number.isFinite(trueHeading) && trueHeading >= 0
          ? trueHeading
          : magneticHeading;

      if (!Number.isFinite(nextHeading) || nextHeading < 0) return;

      const normalisedHeading = ((nextHeading % 360) + 360) % 360;
      setHeading(normalisedHeading);
      setStatus("live");

      let nextRotation = -normalisedHeading;
      const currentRotation = currentRotationRef.current;

      while (nextRotation - currentRotation > 180) nextRotation -= 360;
      while (nextRotation - currentRotation < -180) nextRotation += 360;

      currentRotationRef.current = nextRotation;
      Animated.timing(headingRotation, {
        toValue: nextRotation,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    const startHeading = async () => {
      try {
        let permission = await Location.getForegroundPermissionsAsync();

        if (!permission.granted) {
          permission = await Location.requestForegroundPermissionsAsync();
        }

        if (!mountedRef.current) return;

        if (!permission.granted) {
          setStatus("permission");
          return;
        }

        const subscription = await Location.watchHeadingAsync(
          handleHeading,
          () => {
            if (mountedRef.current) setStatus("unavailable");
          },
        );

        if (!mountedRef.current) {
          subscription.remove?.();
          return;
        }

        headingSubscription.current = subscription;
      } catch (error) {
        if (mountedRef.current) setStatus("unavailable");
      }
    };

    startHeading();

    return () => {
      mountedRef.current = false;
      headingSubscription.current?.remove?.();
      headingSubscription.current = null;
    };
  }, [headingRotation, reveal]);

  const wheelRotate = headingRotation.interpolate({
    inputRange: [-3600, 0, 3600],
    outputRange: ["-3600deg", "0deg", "3600deg"],
  });
  const labelRotate = headingRotation.interpolate({
    inputRange: [-3600, 0, 3600],
    outputRange: ["3600deg", "0deg", "-3600deg"],
  });
  const scale = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  const cardinalForHeading = (value) => {
    if (value == null) return "--";
    const cardinals = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return cardinals[Math.round(value / 45) % cardinals.length];
  };

  const headingReadout =
    heading == null
      ? "---°"
      : `${cardinalForHeading(heading)} ${String(Math.round(heading)).padStart(3, "0")}°`;

  const statusLabel =
    {
      locating: "LOCATING",
      permission: "LOCATION ACCESS NEEDED",
      unavailable: "COMPASS UNAVAILABLE",
    }[status] || null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#061A2D" />
      <ImageBackground
        source={require("../../../../assets/topo-bg-vertical.png")}
        style={StyleSheet.absoluteFillObject}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      />
      <View style={styles.overlay} />

      <Animated.View
        style={[
          styles.compassView,
          { opacity: reveal, transform: [{ scale }] },
        ]}
      >
        <View style={styles.compassTitleBlock}>
          <Text style={styles.compassTitle}>COMPASS</Text>
          <View style={styles.compassTitleAccent} />
        </View>

        <Pressable
          onPress={onBack}
          hitSlop={6}
          style={({ pressed }) => [
            styles.compassTapTarget,
            pressed && styles.compassTapTargetPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Close compass"
        >
          <Animated.View
            style={[
              styles.compassWheel,
              { transform: [{ rotate: wheelRotate }] },
            ]}
          >
            <View style={styles.compassRing}>
              <View style={styles.compassInnerRing} />

              {Array.from({ length: 24 }).map((_, index) => (
                <View
                  key={`compass-tick-${index}`}
                  style={[
                    styles.compassTickOrbit,
                    { transform: [{ rotate: `${index * 15}deg` }] },
                  ]}
                >
                  <View
                    style={[
                      styles.compassTick,
                      index % 6 === 0 && styles.compassMajorTick,
                    ]}
                  />
                </View>
              ))}

              <Animated.Image
                source={require("../../../../assets/compass-logo-pointer-v2.png")}
                style={[
                  styles.compassPointerImage,
                  { transform: [{ rotate: labelRotate }] },
                ]}
                resizeMode="contain"
              />

              <Animated.Text
                style={[
                  styles.compassCardinal,
                  styles.compassNorth,
                  { transform: [{ rotate: labelRotate }] },
                ]}
              >
                N
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.compassCardinal,
                  styles.compassNorthEast,
                  { transform: [{ rotate: labelRotate }] },
                ]}
              >
                NE
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.compassCardinal,
                  styles.compassEast,
                  { transform: [{ rotate: labelRotate }] },
                ]}
              >
                E
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.compassCardinal,
                  styles.compassSouthEast,
                  { transform: [{ rotate: labelRotate }] },
                ]}
              >
                SE
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.compassCardinal,
                  styles.compassSouth,
                  { transform: [{ rotate: labelRotate }] },
                ]}
              >
                S
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.compassCardinal,
                  styles.compassSouthWest,
                  { transform: [{ rotate: labelRotate }] },
                ]}
              >
                SW
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.compassCardinal,
                  styles.compassWest,
                  { transform: [{ rotate: labelRotate }] },
                ]}
              >
                W
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.compassCardinal,
                  styles.compassNorthWest,
                  { transform: [{ rotate: labelRotate }] },
                ]}
              >
                NW
              </Animated.Text>
            </View>
          </Animated.View>
        </Pressable>

        <View style={styles.compassReadout}>
          <Text style={styles.headingReadout}>{headingReadout}</Text>
          <Text style={styles.bearingLabel}>CURRENT BEARING</Text>
          {statusLabel ? (
            <Text style={styles.compassStatus}>{statusLabel}</Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#061A2D" },
  backgroundImage: { opacity: 0.72 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,17,30,0.48)",
  },
  compassView: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  compassTitleBlock: {
    alignItems: "center",
    marginBottom: 22,
  },
  compassTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    letterSpacing: 5,
  },
  compassTitleAccent: {
    width: 34,
    height: 2,
    marginTop: 9,
    borderRadius: 1,
    backgroundColor: "#D6A84F",
  },
  compassWheel: {
    width: 300,
    height: 300,
  },
  compassTapTarget: {
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  compassTapTargetPressed: {
    opacity: 0.88,
  },
  compassRing: {
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 2,
    borderColor: "rgba(214,168,79,0.92)",
    backgroundColor: "#04192B",
    alignItems: "center",
    justifyContent: "center",
  },
  compassInnerRing: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  compassTickOrbit: {
    position: "absolute",
    width: 300,
    height: 300,
    left: 0,
    top: 0,
    alignItems: "center",
  },
  compassPointerImage: {
    position: "absolute",
    left: 15,
    top: 15,
    width: 270,
    height: 270,
  },
  compassTick: {
    width: 1,
    height: 8,
    marginTop: 5,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  compassMajorTick: {
    width: 2,
    height: 14,
    backgroundColor: "#D6A84F",
  },
  compassCardinal: {
    position: "absolute",
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
  },
  compassNorth: { top: 18, color: "#D6A84F" },
  compassNorthEast: {
    right: 48,
    top: 54,
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  compassEast: { right: 17, top: 139 },
  compassSouthEast: {
    right: 48,
    bottom: 54,
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  compassSouth: { bottom: 18, color: "rgba(255,255,255,0.62)" },
  compassSouthWest: {
    left: 48,
    bottom: 54,
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  compassWest: { left: 17, top: 139 },
  compassNorthWest: {
    left: 48,
    top: 54,
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  compassReadout: {
    alignItems: "center",
    marginTop: 38,
  },
  headingReadout: {
    color: "#FFFFFF",
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },
  bearingLabel: {
    color: "rgba(214,168,79,0.92)",
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 2.1,
    marginTop: 3,
  },
  compassStatus: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 7,
  },
});
