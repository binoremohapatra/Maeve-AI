import * as THREE from 'three'
import { VRM } from '@pixiv/three-vrm'

export class MotionManager {
  constructor() {
    this.animations = new Map()
    this.mixer = null
    this.currentAction = null
    this.vrm = null
    this.clock = new THREE.Clock()
  }

  /**
   * Initialize motion manager with VRM instance
   */
  initialize(vrm) {
    this.vrm = vrm
    this.mixer = new THREE.AnimationMixer(vrm.scene)
    console.log('MotionManager initialized with VRM')
  }

  /**
   * Load animation based on file extension
   * Supports: .fbx, .vrma, .bvh, .gltf
   */
  async loadAndApply(vrm, animPath) {
    try {
      console.log(`Loading animation: ${animPath}`)
      
      // Detect file format
      const extension = this.getFileExtension(animPath)
      const animation = await this.loadAnimation(animPath, extension)
      
      if (animation) {
        this.applyAnimation(animation, animPath)
      }
    } catch (error) {
      console.error(`Failed to load animation ${animPath}:`, error)
      // Fallback to procedural animation
      this.applyProceduralAnimation(animPath)
    }
  }

  /**
   * Get file extension from path
   */
  getFileExtension(path) {
    return path.split('.').pop().toLowerCase()
  }

  /**
   * Load animation based on format
   */
  async loadAnimation(path, extension) {
    switch (extension) {
      case 'fbx':
        return await this.loadFBX(path)
      case 'vrma':
        return await this.loadVRMA(path)
      case 'bvh':
        return await this.loadBVH(path)
      case 'gltf':
      case 'glb':
        return await this.loadGLTF(path)
      default:
        throw new Error(`Unsupported animation format: ${extension}`)
    }
  }

  /**
   * Load FBX animation
   */
  async loadFBX(path) {
    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js')
    const loader = new FBXLoader()
    
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (fbx) => {
          // Convert FBX to VRM-compatible format
          const animation = this.convertFBXToVRM(fbx)
          resolve(animation)
        },
        (progress) => {
          console.log(`FBX loading progress: ${(progress.loaded / progress.total * 100)}%`)
        },
        (error) => reject(error)
      )
    })
  }

  /**
   * Load VRMA animation (VRM Animation format)
   */
  async loadVRMA(path) {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const loader = new GLTFLoader()
    
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (gltf) => {
          // VRMA is GLTF with VRM animation data
          const animation = this.convertVRMAToVRM(gltf)
          resolve(animation)
        },
        (progress) => {
          console.log(`VRMA loading progress: ${(progress.loaded / progress.total * 100)}%`)
        },
        (error) => reject(error)
      )
    })
  }

  /**
   * Load BVH animation (motion capture)
   */
  async loadBVH(path) {
    const { BVHLoader } = await import('three/examples/jsm/loaders/BVHLoader.js')
    const loader = new BVHLoader()
    
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (bvh) => {
          const animation = this.convertBVHToVRM(bvh)
          resolve(animation)
        },
        (progress) => {
          console.log(`BVH loading progress: ${(progress.loaded / progress.total * 100)}%`)
        },
        (error) => reject(error)
      )
    })
  }

  /**
   * Load GLTF animation
   */
  async loadGLTF(path) {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const loader = new GLTFLoader()
    
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (gltf) => {
          const animation = this.convertGLTFToVRM(gltf)
          resolve(animation)
        },
        (progress) => {
          console.log(`GLTF loading progress: ${(progress.loaded / progress.total * 100)}%`)
        },
        (error) => reject(error)
      )
    })
  }

  /**
   * Convert FBX to VRM-compatible animation
   */
  convertFBXToVRM(fbx) {
    console.log('Converting FBX to VRM format')
    
    // Extract animation clips
    const clips = fbx.animations || []
    
    // Map FBX bone names to VRM humanoid bones
    const convertedClips = clips.map(clip => {
      const tracks = clip.tracks.map(track => {
        // Convert bone names to VRM standard
        const name = this.mapFBXBoneToVRM(track.name)
        return { ...track, name }
      })
      
      return new THREE.AnimationClip(clip.name, clip.duration, tracks)
    })
    
    return convertedClips[0] // Return first animation
  }

  /**
   * Convert VRMA to VRM animation
   */
  convertVRMAToVRM(gltf) {
    console.log('Converting VRMA to VRM format')
    
    // VRMA is already VRM-compatible
    const animations = gltf.animations || []
    return animations[0]
  }

  /**
   * Convert BVH to VRM animation
   */
  convertBVHToVRM(bvh) {
    console.log('Converting BVH to VRM format')
    
    // BVH contains skeletal animation data
    const tracks = bvh.tracks.map(track => {
      const name = this.mapBVHBoneToVRM(track.name)
      return { ...track, name }
    })
    
    return new THREE.AnimationClip('bvh_animation', bvh.duration, tracks)
  }

  /**
   * Convert GLTF to VRM animation
   */
  convertGLTFToVRM(gltf) {
    console.log('Converting GLTF to VRM format')
    
    const animations = gltf.animations || []
    return animations[0]
  }

  /**
   * Map FBX bone names to VRM standard
   */
  mapFBXBoneToVRM(fbxName) {
    const boneMap = {
      'mixamorig_Hips': 'hips',
      'mixamorig_Spine': 'spine',
      'mixamorig_Spine1': 'chest',
      'mixamorig_Spine2': 'upperChest',
      'mixamorig_Neck': 'neck',
      'mixamorig_Head': 'head',
      'mixamorig_LeftArm': 'leftUpperArm',
      'mixamorig_LeftForeArm': 'leftLowerArm',
      'mixamorig_LeftHand': 'leftHand',
      'mixamorig_RightArm': 'rightUpperArm',
      'mixamorig_RightForeArm': 'rightLowerArm',
      'mixamorig_RightHand': 'rightHand',
      'mixamorig_LeftUpLeg': 'leftUpperLeg',
      'mixamorig_LeftLeg': 'leftLowerLeg',
      'mixamorig_LeftFoot': 'leftFoot',
      'mixamorig_RightUpLeg': 'rightUpperLeg',
      'mixamorig_RightLeg': 'rightLowerLeg',
      'mixamorig_RightFoot': 'rightFoot'
    }
    
    return boneMap[fbxName] || fbxName
  }

  /**
   * Map BVH bone names to VRM standard
   */
  mapBVHBoneToVRM(bvhName) {
    // BVH typically uses standard bone names
    const boneMap = {
      'Hips': 'hips',
      'Spine': 'spine',
      'Chest': 'chest',
      'Neck': 'neck',
      'Head': 'head',
      'LeftArm': 'leftUpperArm',
      'LeftForeArm': 'leftLowerArm',
      'LeftHand': 'leftHand',
      'RightArm': 'rightUpperArm',
      'RightForeArm': 'rightLowerArm',
      'RightHand': 'rightHand',
      'LeftUpLeg': 'leftUpperLeg',
      'LeftLeg': 'leftLowerLeg',
      'LeftFoot': 'leftFoot',
      'RightUpLeg': 'rightUpperLeg',
      'RightLeg': 'rightLowerLeg',
      'RightFoot': 'rightFoot'
    }
    
    return boneMap[bvhName] || bvhName
  }

  /**
   * Apply animation to VRM
   */
  applyAnimation(animation, animPath) {
    if (!this.mixer || !this.vrm) {
      console.error('MotionManager not initialized')
      return
    }

    // Stop current animation
    if (this.currentAction) {
      this.currentAction.stop()
    }

    // Create and start new animation
    const action = this.mixer.clipAction(animation)
    
    // Configure animation based on type
    const situation = this.getSituationFromPath(animPath)
    this.configureAnimation(action, situation)
    
    action.play()
    this.currentAction = action
    
    console.log(`Applied animation: ${animPath}`)
  }

  /**
   * Configure animation based on situation
   */
  configureAnimation(action, situation) {
    switch (situation) {
      case 'idle':
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.setEffectiveWeight(1.0)
        action.fadeIn(0.5)
        break
        
      case 'typing':
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.setEffectiveWeight(1.0)
        action.fadeIn(0.2)
        action.timeScale = 1.5 // Faster typing
        break
        
      case 'greeting':
        action.setLoop(THREE.LoopOnce)
        action.setEffectiveWeight(1.0)
        action.fadeIn(0.3)
        action.fadeOut(0.5)
        action.clampWhenFinished = true
        break
        
      case 'thinking':
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.setEffectiveWeight(0.8)
        action.fadeIn(0.4)
        break
        
      case 'success':
        action.setLoop(THREE.LoopOnce)
        action.setEffectiveWeight(1.0)
        action.fadeIn(0.2)
        action.fadeOut(0.8)
        action.clampWhenFinished = true
        break
        
      default:
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.setEffectiveWeight(1.0)
        action.fadeIn(0.3)
    }
  }

  /**
   * Extract situation from animation path
   */
  getSituationFromPath(path) {
    const filename = path.split('/').pop().split('.')[0]
    return filename.toLowerCase()
  }

  /**
   * Apply procedural animation as fallback
   */
  applyProceduralAnimation(animPath) {
    const situation = this.getSituationFromPath(animPath)
    console.log(`Applying procedural animation for: ${situation}`)
    
    if (!this.vrm) return
    
    switch (situation) {
      case 'idle':
        this.applyIdleAnimation()
        break
      case 'typing':
        this.applyTypingAnimation()
        break
      case 'greeting':
        this.applyGreetingAnimation()
        break
      case 'thinking':
        this.applyThinkingAnimation()
        break
      case 'success':
        this.applySuccessAnimation()
        break
    }
  }

  /**
   * Procedural idle animation
   */
  applyIdleAnimation() {
    // Subtle breathing and sway
    const breathe = () => {
      if (!this.vrm || !this.vrm.humanoid) return
      
      const time = this.clock.getElapsedTime()
      const chest = this.vrm.humanoid.getBone('chest')
      
      if (chest) {
        chest.rotation.x = Math.sin(time * 2) * 0.05
        chest.scale.y = 1 + Math.sin(time * 2) * 0.02
      }
    }
    
    this.proceduralUpdate = breathe
  }

  /**
   * Procedural typing animation
   */
  applyTypingAnimation() {
    // Hand and finger movement for typing
    const type = () => {
      if (!this.vrm || !this.vrm.humanoid) return
      
      const time = this.clock.getElapsedTime()
      const leftHand = this.vrm.humanoid.getBone('leftHand')
      const rightHand = this.vrm.humanoid.getBone('rightHand')
      
      if (leftHand && rightHand) {
        // Typing motion
        leftHand.rotation.z = Math.sin(time * 8) * 0.1
        rightHand.rotation.z = Math.cos(time * 8) * 0.1
      }
    }
    
    this.proceduralUpdate = type
  }

  /**
   * Procedural greeting animation
   */
  applyGreetingAnimation() {
    // Wave motion
    const wave = () => {
      if (!this.vrm || !this.vrm.humanoid) return
      
      const time = this.clock.getElapsedTime()
      const rightHand = this.vrm.humanoid.getBone('rightHand')
      
      if (rightHand) {
        rightHand.rotation.y = Math.sin(time * 4) * 0.5
        rightHand.rotation.z = Math.sin(time * 8) * 0.3
      }
    }
    
    this.proceduralUpdate = wave
  }

  /**
   * Procedural thinking animation
   */
  applyThinkingAnimation() {
    // Head tilt and chin touch
    const think = () => {
      if (!this.vrm || !this.vrm.humanoid) return
      
      const time = this.clock.getElapsedTime()
      const head = this.vrm.humanoid.getBone('head')
      
      if (head) {
        head.rotation.y = Math.sin(time * 1) * 0.1
        head.rotation.x = Math.sin(time * 1.5) * 0.05
      }
    }
    
    this.proceduralUpdate = think
  }

  /**
   * Procedural success animation
   */
  applySuccessAnimation() {
    // Victory pose
    const celebrate = () => {
      if (!this.vrm || !this.vrm.humanoid) return
      
      const time = this.clock.getElapsedTime()
      const leftHand = this.vrm.humanoid.getBone('leftHand')
      const rightHand = this.vrm.humanoid.getBone('rightHand')
      
      if (leftHand && rightHand) {
        leftHand.rotation.z = Math.sin(time * 6) * 0.3
        rightHand.rotation.z = Math.cos(time * 6) * 0.3
      }
    }
    
    this.proceduralUpdate = celebrate
  }

  /**
   * Update animation mixer
   */
  update(deltaTime) {
    if (this.mixer) {
      this.mixer.update(deltaTime)
    }
    
    // Apply procedural animation if active
    if (this.proceduralUpdate) {
      this.proceduralUpdate()
    }
  }

  /**
   * Stop current animation
   */
  stop() {
    if (this.currentAction) {
      this.currentAction.stop()
      this.currentAction = null
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.mixer) {
      this.mixer.stopAllAction()
      this.mixer.uncacheRoot(this.vrm?.scene)
    }
    
    this.animations.clear()
    this.currentAction = null
    this.vrm = null
    this.proceduralUpdate = null
  }
}
