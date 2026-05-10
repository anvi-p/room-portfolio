import * as THREE from 'three';
import './style.scss'
import { OrbitControls } from './utils/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from "gsap";

const canvas = document.querySelector("#mesh-canvas");
const container = document.getElementById('mesh-container');

const sizes = {
  width: container.clientWidth,
  height: container.clientHeight
};

const raycasterObjs = [];
let currentIntersects = [];
let currActiveObject = null;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);

const textureLoader = new THREE.TextureLoader();
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/'); 
loader.setDRACOLoader(dracoLoader);

const environmentMap = new THREE.CubeTextureLoader()
	.setPath( 'textures/skybox/' )
	.load( [
				'px.webp',
				'nx.webp',
				'py.webp',
				'ny.webp',
				'pz.webp',
				'nz.webp'
			] );

const textureMap = {
  items: textureLoader.load("/textures/room/denoised_items.webp"),
  foundation: textureLoader.load("/textures/room/denoised_foundation.webp"),
  photos: textureLoader.load("/textures/room/denoised_photos.webp"),
  domain: textureLoader.load("/textures/room/denoised_domain.webp"),
};

Object.values(textureMap).forEach(tex => {
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
});

const scene = new THREE.Scene();

window.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
});

window.addEventListener("click", () => {
  // We use the intersects from the raycaster (updated in render loop)
  if (currentIntersects.length > 0) {
    const hit = currentIntersects[0].object;
    
    // Check if the object hit has a sectionTarget
    if (hit.userData.isButton && hit.userData.sectionTarget) {
      const targetClass = hit.userData.sectionTarget;
      const section = document.querySelector(`.${targetClass}`);

      if (section) {
        history.pushState(null, null, `#${targetClass}`);
        section.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }
  }
});

/* Load all textures into the scene */
loader.load("/models/Room_Portfolio-v3.glb", (glb) => {
  glb.scene.traverse((child) => {
    if(child.isMesh){
      if(child.name.includes("PC_Glass")){
        child.material = new THREE.MeshPhysicalMaterial({
          transmission: 1,
          opacity: 0.5,
          metalness: 0,
          roughness: 0,
          ior: 1.5,
          thickness: 0.1,
          specularIntensity: 1,
          envMap: environmentMap,
          envMapIntensity: 1,
        });
      }
      else{
        let matchedTexture = textureMap.items;
        if(child.name.includes("Foundation_Merged")){
          matchedTexture = textureMap.foundation;
        }
        else if(child.name.includes("Paintings")){
          matchedTexture = textureMap.photos;
        }
        else if(child.name.includes("Domain")){
          matchedTexture = textureMap.domain;
        }
        child.material = new THREE.MeshBasicMaterial({
          map: matchedTexture,
        });
      }

      if(child.material.map){
        child.material.map.minFilter = THREE.LinearFilter;
      }

      const excluded = [
        "Scene",
        "Foundation_Merged",
        "Items_Merged",
        "PC_Glass",
        "Paintings",
        "Domain",
        "PostIts"
      ];

      const isInteractable = !excluded.some(name =>
        child.name.includes(name)
      );

      if(isInteractable){
        const box = new THREE.Box3().setFromObject(child);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();

        box.getSize(size);
        box.getCenter(center);

        const collider = new THREE.Mesh(
          new THREE.BoxGeometry(
            size.x * 0.6,
            size.y * 0.6,
            size.z * 0.6
          ),
          new THREE.MeshBasicMaterial({
            visible: false
          })
        );

        collider.position.copy(center);
        collider.userData.visual = child;
        if (child.name.includes("Button")){
          collider.userData.isButton = true;
          if (child.name.includes("About")) collider.userData.sectionTarget = "about";
          else if (child.name.includes("Experience")) collider.userData.sectionTarget = "experience";
          else if (child.name.includes("Education")) collider.userData.sectionTarget = "education";
          else if (child.name.includes("Projects")) collider.userData.sectionTarget = "projects";
        }

        child.userData.initialScale = child.scale.clone();
        child.userData.initialRotation = child.rotation.clone();
        child.userData.initialPosition = child.position.clone();


        raycasterObjs.push(collider);
        scene.add(collider);
      } 
    }
  }); 
  scene.add(glb.scene);
});

const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 1000);
camera.position.set(12, 6, 16);

const renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace; 

const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 5;
controls.maxDistance = 22;

controls.minPolarAngle = Math.PI / 8;
controls.maxPolarAngle = Math.PI / 2;
controls.minAzimuthAngle = Math.PI / 8;
controls.maxAzimuthAngle = Math.PI / 3;

controls.enableDamping = true; 
controls.dampingFactor = 0.05;
controls.target.set(1, 2, 0);
controls.enablePan = false;
controls.update();

window.addEventListener("resize", () => {
  sizes.width =  container.clientWidth;
  sizes.height = container.clientHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
});

function animate(object, isActive){
  gsap.killTweensOf(object.scale);
  gsap.killTweensOf(object.rotation);
  gsap.killTweensOf(object.position);

  const isChair = object.name.includes("Chair");
  
  if(isActive){ // Hover state
    if(isChair){
      gsap.to(object.rotation, {
        x: object.userData.initialRotation.x - Math.PI / 20,
        z: object.userData.initialRotation.z - Math.PI / 20,
        duration: 0.4,
        ease: "power2.out",
      });
    }

    else{
      var up_amount = object.name.includes("Button")? 0.2 : 0.1;
      gsap.to(object.position, {
        y: object.userData.initialPosition.y + up_amount,
        duration: 0.25,
        ease: "power2.out",
      });
    }
  }

  else{ // Reset / Non-hover state
    if(isChair){
      gsap.to(object.rotation, {
        x: object.userData.initialRotation.x,
        y: object.userData.initialRotation.y,
        z: object.userData.initialRotation.z,
        duration: 0.3,
        ease: "power2.out",
      });
    }
    else{
      gsap.to(object.position, {
        y: object.userData.initialPosition.y,
        duration: 0.2,
        ease: "power2.out",
      });
    }
  }
}

const render = () => {
  controls.update();
  raycaster.setFromCamera(pointer, camera);
  currentIntersects = raycaster.intersectObjects(raycasterObjs);

  if(currentIntersects.length > 0){
    const hit = currentIntersects[0].object;
    const obj = hit.userData.visual;
    if(obj !== currActiveObject){
      if(currActiveObject){
        animate(currActiveObject, false);
      }
      animate(obj, true);
      currActiveObject = obj;
    }
    if (hit.userData.isButton) {
      document.body.style.cursor = "pointer";
    } 
    else {
      document.body.style.cursor = "default";
    }
  } 
  else{
    if(currActiveObject){
      animate(currActiveObject, false);
      currActiveObject = null;
    }
    document.body.style.cursor = "default";
  }
  renderer.render(scene, camera);
  requestAnimationFrame(render);
};

render();

const textSection = document.querySelector('.text-section');
const backToTop = document.getElementById('backToTop');
function isMobileLayout() {
  return window.innerWidth <= 768; // same breakpoint as CSS
}

// Show/hide button depending on scroll position
function updateButtonVisibility() {
  if (isMobileLayout()) {
    if (window.scrollY > 200) {
      backToTop.classList.add('show');
    } 
    else{
      backToTop.classList.remove('show');
    }
  } 
  else{
    if (textSection.scrollTop > 200) {
      backToTop.classList.add('show');
    } 
    else{
      backToTop.classList.remove('show');
    }
  }
}

// Scroll to top
backToTop.addEventListener('click', () => {
  if (isMobileLayout()) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } 
  else{
    textSection.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

// Listeners
textSection.addEventListener('scroll', updateButtonVisibility);
window.addEventListener('scroll', updateButtonVisibility);
window.addEventListener('resize', updateButtonVisibility);

// Initial check
updateButtonVisibility();

window.addEventListener('load', () => {
  const targetClass = window.location.hash.replace('#', '');
  if (targetClass) {
    const section = document.querySelector(`.${targetClass}`);
    if (section) {
      setTimeout(() => { // Small timeout to ensure layout is ready
        history.pushState(null, null, `#${targetClass}`);
        section.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 500);
    }
  }
});