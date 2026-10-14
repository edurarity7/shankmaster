// Post-processing: bloom (glowing lights, gems, pickups), colour grade + vignette. Viewmodel is drawn on top.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const Grade = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uSat: { value: 1.12 }, uTint: { value: new THREE.Color(0, 0, 0) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; uniform float uSat; uniform vec3 uTint; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(.299,.587,.114)); c.rgb = mix(vec3(l), c.rgb, uSat);
    float d = distance(vUv, vec2(.5)); c.rgb *= 1. - uVig * smoothstep(.3, .9, d); c.rgb += uTint * smoothstep(.25, .8, d); gl_FragColor = c; }`,
};

export class Post {
  constructor(renderer) {
    this.r = renderer;
    this.composer = new EffectComposer(renderer);
    this.main = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.over = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera()); this.over.clear = false; this.over.clearDepth = true; this.over.enabled = false;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.5, 0.97);
    this.grade = new ShaderPass(Grade);
    this.composer.addPass(this.main); this.composer.addPass(this.over); this.composer.addPass(this.bloom); this.composer.addPass(this.grade); this.composer.addPass(new OutputPass());
  }
  set(scene, camera, overScene, overCam) {
    this.main.scene = scene; this.main.camera = camera;
    this.over.enabled = !!overScene; if (overScene) { this.over.scene = overScene; this.over.camera = overCam; }
  }
  tint(c) { this.grade.uniforms.uTint.value.copy(c); }
  resize(w, h, pr) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); this.bloom.resolution.set(w / 2, h / 2); }
  render(dt) { this.composer.render(dt); }
}
