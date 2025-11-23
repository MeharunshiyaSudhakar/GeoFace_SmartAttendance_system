import * as faceapi from 'face-api.js';
import canvas from 'canvas';
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

export const verifyFace = async (capturedDataUrl, registeredDataUrl) => {
  await faceapi.nets.ssdMobilenetv1.loadFromDisk('./models');
  await faceapi.nets.faceRecognitionNet.loadFromDisk('./models');
  await faceapi.nets.faceLandmark68Net.loadFromDisk('./models');

  const loadImage = async (dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    return img;
  };

  const capturedImg = await loadImage(capturedDataUrl);
  const registeredImg = await loadImage(registeredDataUrl);

  const capturedDescriptor = await faceapi
    .detectSingleFace(capturedImg)
    .withFaceLandmarks()
    .withFaceDescriptor();

  const registeredDescriptor = await faceapi
    .detectSingleFace(registeredImg)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!capturedDescriptor || !registeredDescriptor) return false;

  const distance = faceapi.euclideanDistance(capturedDescriptor.descriptor, registeredDescriptor.descriptor);
  return distance < 0.6; // typical threshold
};
