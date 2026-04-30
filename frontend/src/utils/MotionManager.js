export class MotionManager {
  constructor() {
    this.worker = null
    this.animations = new Map()
    this.currentAnimation = null
    this.isConverting = false
    this.initializeWorker()
  }
  
  initializeWorker() {
    this.worker = new Worker('/src/workers/MotionConversionWorker.js')
    
    this.worker.onmessage = (event) => {
      const { type, data } = event.data
      
      switch (type) {
        case 'CONVERSION_COMPLETE':
          this.handleConversionComplete(data)
          break
        case 'CONVERSION_ERROR':
          console.error('Motion conversion error:', data.error)
          this.isConverting = false
          break
        case 'PROGRESS':
          console.log('Conversion progress:', data.progress)
          break
      }
    }
  }
  
  async convertMixamoFBX(fbxData, targetVRM) {
    if (this.isConverting) {
      throw new Error('Another conversion is in progress')
    }
    
    this.isConverting = true
    
    this.worker.postMessage({
      type: 'CONVERT_MIXAMO',
      data: {
        fbxData,
        targetVRM,
        options: {
          retarget: true,
          normalize: true,
          optimize: true
        }
      }
    })
  }
  
  async convertMootionFBX(fbxData, targetVRM) {
    if (this.isConverting) {
      throw new Error('Another conversion is in progress')
    }
    
    this.isConverting = true
    
    this.worker.postMessage({
      type: 'CONVERT_MOOTION',
      data: {
        fbxData,
        targetVRM,
        options: {
          aiEnhanced: true,
          smoothTransitions: true,
          autoRig: true
        }
      }
    })
  }
  
  async convertVRMA(vrmaData, targetVRM) {
    if (this.isConverting) {
      throw new Error('Another conversion is in progress')
    }
    
    this.isConverting = true
    
    this.worker.postMessage({
      type: 'CONVERT_VRMA',
      data: {
        vrmaData,
        targetVRM,
        options: {
          preserveExpressions: true,
          blendShapes: true,
          timelineSync: true
        }
      }
    })
  }
  
  async convertBVH(bvhData, targetVRM) {
    if (this.isConverting) {
      throw new Error('Another conversion is in progress')
    }
    
    this.isConverting = true
    
    this.worker.postMessage({
      type: 'CONVERT_BVH',
      data: {
        bvhData,
        targetVRM,
        options: {
          cleanupNoise: true,
          smoothInterpolation: true,
          optimizeKeyframes: true
        }
      }
    })
  }
  
  handleConversionComplete(data) {
    const { animationId, motionData, metadata } = data
    
    this.animations.set(animationId, {
      motionData,
      metadata,
      timestamp: Date.now()
    })
    
    this.isConverting = false
    
    // Trigger event for animation ready
    window.dispatchEvent(new CustomEvent('motionReady', {
      detail: { animationId, motionData }
    }))
  }
  
  getAnimation(animationId) {
    return this.animations.get(animationId)
  }
  
  playAnimation(animationId, vrmCharacter) {
    const animation = this.animations.get(animationId)
    if (!animation || !vrmCharacter) {
      return false
    }
    
    this.currentAnimation = animationId
    
    // Apply motion data to VRM character
    this.applyMotionToVRM(animation.motionData, vrmCharacter)
    
    return true
  }
  
  applyMotionToVRM(motionData, vrmCharacter) {
    if (!vrmCharacter.humanoid) return
    
    const { bones, timeline, expressions } = motionData
    
    // Apply bone transformations
    Object.entries(bones).forEach(([boneName, transforms]) => {
      const bone = vrmCharacter.humanoid.getBone(boneName)
      if (bone) {
        transforms.forEach((transform, frame) => {
          // Apply transformation at specific frame
          this.setBoneTransform(bone, transform, frame)
        })
      }
    })
    
    // Apply facial expressions
    if (expressions && vrmCharacter.expressionManager) {
      Object.entries(expressions).forEach(([expressionName, values]) => {
        vrmCharacter.expressionManager.setValue(expressionName, values)
      })
    }
  }
  
  setBoneTransform(bone, transform, frame) {
    if (transform.position) {
      bone.position.fromArray(transform.position)
    }
    if (transform.rotation) {
      bone.quaternion.fromArray(transform.rotation)
    }
    if (transform.scale) {
      bone.scale.fromArray(transform.scale)
    }
  }
  
  stopAnimation() {
    this.currentAnimation = null
  }
  
  preloadAnimations(animationList) {
    animationList.forEach(async (anim) => {
      try {
        await this.loadAnimation(anim)
      } catch (error) {
        console.error(`Failed to preload animation ${anim.id}:`, error)
      }
    })
  }
  
  async loadAnimation(animationConfig) {
    const { id, type, source } = animationConfig
    
    try {
      const response = await fetch(source)
      const data = await response.arrayBuffer()
      
      switch (type) {
        case 'mixamo':
          await this.convertMixamoFBX(data, null)
          break
        case 'mootion':
          await this.convertMootionFBX(data, null)
          break
        case 'vrma':
          await this.convertVRMA(data, null)
          break
        case 'bvh':
          await this.convertBVH(data, null)
          break
      }
    } catch (error) {
      throw new Error(`Failed to load animation ${id}: ${error.message}`)
    }
  }
}

// Singleton instance
export const motionManager = new MotionManager()
