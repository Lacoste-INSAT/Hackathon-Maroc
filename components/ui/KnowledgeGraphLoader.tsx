"use client"

import React, { useEffect, useRef } from "react"
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from "react-native"
import Svg, { Circle, Line, G, Defs, LinearGradient, Stop } from "react-native-svg"

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)

interface Node {
  id: string
  x: number
  y: number
  label: string
  type: "diagnosis" | "medication" | "symptom" | "pathway" | "relation"
  color: string
}

interface Edge {
  from: string
  to: string
  animated: boolean
}

interface KnowledgeGraphLoaderProps {
  size?: "sm" | "md" | "lg"
  message?: string
  style?: object
}

const TYPE_COLORS = {
  diagnosis: "#3b82f6",
  medication: "#10b981",
  symptom: "#f59e0b",
  pathway: "#8b5cf6",
  relation: "#ec4899",
}

const SIZES = {
  sm: { width: 120, height: 120, nodeRadius: 6, fontSize: 12 },
  md: { width: 200, height: 200, nodeRadius: 10, fontSize: 14 },
  lg: { width: 280, height: 280, nodeRadius: 14, fontSize: 16 },
}

export default function KnowledgeGraphLoader({
  size = "md",
  message = "Analyzing knowledge graph...",
  style,
}: KnowledgeGraphLoaderProps) {
  const config = SIZES[size]
  
  // Helper to map 0-1 relative coordinates to absolute coordinates within the container
  const getX = (relX: number) => config.width * relX
  const getY = (relY: number) => config.height * relY

  // Create a more organic, scattered network layout (like a neural pathway)
  const allNodes: Node[] = [
    { id: "n1", x: getX(0.5), y: getY(0.55), label: "", type: "diagnosis", color: TYPE_COLORS.diagnosis },
    { id: "n2", x: getX(0.2), y: getY(0.3), label: "", type: "medication", color: TYPE_COLORS.medication },
    { id: "n3", x: getX(0.75), y: getY(0.2), label: "", type: "symptom", color: TYPE_COLORS.symptom },
    { id: "n4", x: getX(0.3), y: getY(0.75), label: "", type: "pathway", color: TYPE_COLORS.pathway },
    { id: "n5", x: getX(0.75), y: getY(0.8), label: "", type: "relation", color: TYPE_COLORS.relation },
    { id: "n6", x: getX(0.15), y: getY(0.55), label: "", type: "symptom", color: TYPE_COLORS.symptom },
    { id: "n7", x: getX(0.9), y: getY(0.5), label: "", type: "diagnosis", color: TYPE_COLORS.diagnosis },
    { id: "n8", x: getX(0.45), y: getY(0.25), label: "", type: "medication", color: TYPE_COLORS.medication },
    { id: "n9", x: getX(0.65), y: getY(0.5), label: "", type: "pathway", color: TYPE_COLORS.pathway },
    { id: "n10", x: getX(0.5), y: getY(0.85), label: "", type: "relation", color: TYPE_COLORS.relation },
  ]

  const edges: Edge[] = [
    { from: "n1", to: "n3", animated: true },
    { from: "n1", to: "n8", animated: true },
    { from: "n1", to: "n9", animated: false },
    { from: "n1", to: "n4", animated: true },
    { from: "n1", to: "n10", animated: true },
    { from: "n2", to: "n6", animated: true },
    { from: "n2", to: "n8", animated: false },
    { from: "n3", to: "n7", animated: false },
    { from: "n3", to: "n8", animated: true },
    { from: "n3", to: "n9", animated: false },
    { from: "n4", to: "n6", animated: false },
    { from: "n4", to: "n10", animated: true },
    { from: "n5", to: "n7", animated: true },
    { from: "n5", to: "n9", animated: true },
    { from: "n5", to: "n10", animated: false },
    { from: "n9", to: "n10", animated: true },
    { from: "n9", to: "n7", animated: false },
  ]

  // Animation values
  const pulseAnims = useRef(allNodes.map(() => new Animated.Value(0))).current
  const rotateAnim = useRef(new Animated.Value(0)).current
  const edgeOpacityAnims = useRef(edges.map(() => new Animated.Value(0.3))).current

  useEffect(() => {
    // Node pulse animations with staggered delays
    const pulseAnimations = pulseAnims.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    )

    // Rotation animation
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )

    // Edge pulse animations
    const edgeAnimations = edgeOpacityAnims.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 100),
          Animated.timing(anim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    )

    Animated.parallel([...pulseAnimations, ...edgeAnimations]).start()

    return () => {
      pulseAnims.forEach((anim) => anim.stopAnimation())
      edgeOpacityAnims.forEach((anim) => anim.stopAnimation())
    }
  }, [])

  const getNodeById = (id: string) => allNodes.find((n) => n.id === id)

  return (
    <View style={[styles.container, style]}>
      <View>
        <Svg width={config.width} height={config.height}>
          <Defs>
            <LinearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
              <Stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.8} />
              <Stop offset="100%" stopColor="#ec4899" stopOpacity={0.2} />
            </LinearGradient>
          </Defs>

          {/* Edges */}
          <G>
            {edges.map((edge, index) => {
              const fromNode = getNodeById(edge.from)
              const toNode = getNodeById(edge.to)
              if (!fromNode || !toNode) return null

              return (
                <AnimatedLine
                  key={`edge-${index}`}
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={edge.animated ? "url(#edgeGradient)" : "#4b5563"}
                  strokeWidth={edge.animated ? 2 : 1}
                  opacity={edgeOpacityAnims[index]}
                />
              )
            })}
          </G>

          {/* Nodes */}
          <G>
            {allNodes.map((node, index) => {
              const scale = pulseAnims[index].interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.3],
              })

              const opacity = pulseAnims[index].interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1],
              })

              const nodeRadius = config.nodeRadius

              return (
                <G key={node.id}>
                  {/* Glow effect */}
                  <AnimatedCircle
                    cx={node.x}
                    cy={node.y}
                    r={nodeRadius * 2}
                    fill={node.color}
                    opacity={pulseAnims[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.1, 0.3],
                    })}
                  />
                  {/* Main node */}
                  <Circle
                    cx={node.x}
                    cy={node.y}
                    r={nodeRadius}
                    fill={node.color}
                  />
                  {/* Inner highlight */}
                  <Circle
                    cx={node.x - nodeRadius * 0.2}
                    cy={node.y - nodeRadius * 0.2}
                    r={nodeRadius * 0.3}
                    fill="rgba(255,255,255,0.4)"
                  />
                </G>
              )
            })}
          </G>
        </Svg>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <View key={type} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>
              {type === "diagnosis" ? "Dx" : 
               type === "medication" ? "Rx" : 
               type === "symptom" ? "Sx" : 
               type === "pathway" ? "Path" : "Rel"}
            </Text>
          </View>
        ))}
      </View>

      {/* Message */}
      {message && (
        <Text style={[styles.message, { fontSize: config.fontSize }]}>{message}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 16,
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: "#9ca3af",
    fontWeight: "500",
  },
  message: {
    marginTop: 16,
    color: "#d1d5db",
    fontWeight: "500",
    textAlign: "center",
  },
})
