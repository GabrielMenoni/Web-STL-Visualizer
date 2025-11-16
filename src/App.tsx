import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';
import { FileList } from './FileList';

// ==================== TYPES ====================

/**
 * Represents an STL file loaded in the editor
 */
type STLFile = {
  name: string;
  url: string;
  visible?: boolean; // Controls whether the model is visible or hidden
  color?: string; // Fixed color assigned to the model
};

/**
 * Transformations applied to a 3D model
 */
type ModelTransformations = {
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
};

/**
 * Available axes for manipulation
 */
type TransformationAxis = 'positionX' | 'positionY' | 'positionZ' | 'rotationX' | 'rotationY' | 'rotationZ';

/**
 * Supported measurement units for conversion
 */
type MeasurementUnit = 'mm' | 'cm' | 'inches';

/**
 * Conversion factors to millimeters
 * Used to ensure transformations are in real mm
 */
const UNIT_TO_MM: Record<MeasurementUnit, number> = {
  mm: 1,      // 1 Three.js unit = 1mm
  cm: 10,     // 1 Three.js unit = 10mm
  inches: 25.4 // 1 Three.js unit = 25.4mm
};


// ==================== UTILITIES ====================

/**
 * Returns a color based on the file index
 * Used to visually differentiate multiple STL models
 */
function getColorByIndex(index: number): string {
  const AVAILABLE_COLORS = [
    '#858585',
    '#9a9a9a',
    '#b0b0b0',
    '#c5c5c5',
    '#dbdbdb',
    '#eeeeee',
    '#ffffff'
  ];
  return AVAILABLE_COLORS[index % AVAILABLE_COLORS.length];
}

// ==================== 3D COMPONENTS ====================

/**
 * Component that renders a single STL model
 * Applies position, rotation, and color transformations to the model
 */
function STLModel({
  stlFile,
  color,
  transformations
}: {
  stlFile: STLFile;
  color: string;
  transformations: ModelTransformations;
}) {
  const geometry = useLoader(STLLoader, stlFile.url);

  return (
    <mesh
      geometry={geometry}
      name={stlFile.name}
      position={[
        transformations.positionX || 0,
        transformations.positionY || 0,
        transformations.positionZ || 0,
      ]}
      rotation={[
        transformations.rotationX || 0,
        transformations.rotationY || 0,
        transformations.rotationZ || 0,
      ]}
    >
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/**
 * Component that manages and renders all loaded STL models
 * Automatically centers the camera when new files are added
 */
function ModelsContainer({
  files,
  selectedFile,
  transformations
}: {
  files: STLFile[];
  selectedFile: STLFile | null;
  transformations: Record<string, ModelTransformations>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const previousFileCountRef = useRef(0);

  // Adjust camera ONLY when new files are added (not when visibility changes)
  useEffect(() => {
    const currentFileCount = files.length;

    // Only adjust camera if the number of files changed (new files added or removed)
    if (groupRef.current && currentFileCount > 0 && currentFileCount !== previousFileCountRef.current) {
      // Calculate the bounding box of all models
      const boundingBox = new THREE.Box3().setFromObject(groupRef.current);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();

      boundingBox.getCenter(center);
      boundingBox.getSize(size);

      // Set camera distance based on models size
      const cameraDistance = size.length() * 1.5;

      // Center the models group at the origin
      groupRef.current.position.set(-center.x, -center.y, -center.z);

      // Position the camera
      const newCameraPosition = center.clone().add(
        new THREE.Vector3(0, 0, cameraDistance)
      );
      camera.position.copy(newCameraPosition);
      camera.lookAt(center);

      // Update the previous count
      previousFileCountRef.current = currentFileCount;
    }
  }, [files.length, camera]); // Dependency only on array size, not the complete array

  return (
    <group ref={groupRef}>
      {files
        .filter(file => file.visible !== false) // Render only visible models
        .map((file) => (
          <STLModel
            key={file.url}
            stlFile={file}
            color={file === selectedFile ? 'red' : (file.color || '#858585')}
            transformations={transformations[file.name] || {}}
          />
        ))}
    </group>
  );
}

// ==================== UI COMPONENTS ====================

/**
 * Control panel for selected model transformations
 */
function TransformationPanel({
  selectedFile,
  transformations,
  onTransformationUpdate,
  stlUnit,
  onUnitChange
}: {
  selectedFile: STLFile;
  transformations: Record<string, ModelTransformations>;
  onTransformationUpdate: (fileName: string, axis: TransformationAxis, value: number) => void;
  stlUnit: MeasurementUnit;
  onUnitChange: (unit: MeasurementUnit) => void;
}) {
  const [selectedAxis, setSelectedAxis] = useState<TransformationAxis>('positionX');
  const [transformMode, setTransformMode] = useState<'position' | 'rotation'>('position');

  const POSITION_AXES: TransformationAxis[] = ['positionX', 'positionY', 'positionZ'];
  const ROTATION_AXES: TransformationAxis[] = ['rotationX', 'rotationY', 'rotationZ'];

  const AXIS_LABELS: Record<TransformationAxis, string> = {
    positionX: 'X Axis',
    positionY: 'Y Axis',
    positionZ: 'Z Axis',
    rotationX: 'X Axis',
    rotationY: 'Y Axis',
    rotationZ: 'Z Axis'
  };

  // Calculate the real value in Three.js units based on conversion
  const conversionFactor = UNIT_TO_MM[stlUnit];

  // Determine axes and adjustments based on mode
  const currentAxes = transformMode === 'position' ? POSITION_AXES : ROTATION_AXES;

  // Convert radians to degrees for display
  const radiansToDegrees = (radians: number) => {
    const degrees = radians * 180 / Math.PI;
    // Normalize to 0-360
    return ((degrees % 360) + 360) % 360;
  };

  // Convert degrees to radians for application (normalized 0-360)
  const degreesToRadians = (degrees: number) => {
    const normalized = ((degrees % 360) + 360) % 360;
    return normalized * Math.PI / 180;
  };

  // Update rotation cyclically (0-360 degrees)
  const updateRotation = (axis: TransformationAxis, degreesIncrement: number) => {
    const currentRadians = transformations[selectedFile.name]?.[axis] || 0;
    const currentDegrees = radiansToDegrees(currentRadians);
    const newDegrees = currentDegrees + degreesIncrement;
    const normalizedRadians = degreesToRadians(newDegrees);

    // Replace current value instead of incrementing
    onTransformationUpdate(selectedFile.name, axis, normalizedRadians - currentRadians);
  };

  return (
    <div className="mt-4">
      {/* Mode selector (Position/Rotation) */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => {
            setTransformMode('position');
            setSelectedAxis('positionX');
          }}
          className={`flex-1 px-4 py-2 rounded font-semibold cursor-pointer ${transformMode === 'position'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
          Position
        </button>
        <button
          onClick={() => {
            setTransformMode('rotation');
            setSelectedAxis('rotationX');
          }}
          className={`flex-1 px-4 py-2 rounded font-semibold cursor-pointer ${transformMode === 'rotation'
            ? 'bg-green-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
          Rotation
        </button>
      </div>

      {/* STL file unit selector (position only) */}
      {transformMode === 'position' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-sm font-semibold">
              STL file unit:
            </label>
            <div className="relative group">
              <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold cursor-help">
                ?
              </div>
              {/* Tooltip */}
              <div className="absolute left-0 top-7 w-64 p-3 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 z-10">
                <p className="mb-2">
                  <strong>Why is this necessary?</strong>
                </p>
                <p>
                  Three.js doesn't have fixed units. It uses "abstract units" that depend on how your STL file was exported.
                  If the CAD software exported in millimeters, 1 unit = 1mm. If exported in centimeters, 1 unit = 10mm.
                </p>
                <p className="mt-2">
                  Select the correct unit so that transformations are accurate in real millimeters.
                </p>
                {/* Tooltip arrow */}
                <div className="absolute left-4 -top-2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-800"></div>
              </div>
            </div>
          </div>
          <select
            value={stlUnit}
            onChange={(e) => onUnitChange(e.target.value as MeasurementUnit)}
            className="w-full px-2 py-1 border border-gray-300 rounded cursor-pointer"
          >
            <option value="mm">Millimeters (mm)</option>
            <option value="cm">Centimeters (cm)</option>
            <option value="inches">Inches</option>
          </select>
        </div>
      )}

      {/* Axis selector */}
      <div className="flex mb-2">
        {currentAxes.map(axis => (
          <button
            key={axis}
            onClick={() => setSelectedAxis(axis)}
            className={`px-2 py-1 cursor-pointer ${selectedAxis === axis ? 'bg-blue-400' : 'bg-gray-300'
              } rounded mr-2`}
          >
            {AXIS_LABELS[axis]}
          </button>
        ))}
      </div>

      {/* Adjustment buttons for POSITION */}
      {transformMode === 'position' && (
        <div className="flex mb-4">
          <button
            onClick={() => onTransformationUpdate(selectedFile.name, selectedAxis, -10 / conversionFactor)}
            className="px-2 py-1 bg-gray-300 rounded mr-2 cursor-pointer hover:bg-gray-400"
            title={`Move -10mm (${(-10 / conversionFactor).toFixed(2)} file units)`}
          >
            -10mm
          </button>
          <button
            onClick={() => onTransformationUpdate(selectedFile.name, selectedAxis, -1 / conversionFactor)}
            className="px-2 py-1 bg-gray-300 rounded mr-2 cursor-pointer hover:bg-gray-400"
            title={`Move -1mm (${(-1 / conversionFactor).toFixed(2)} file units)`}
          >
            -1mm
          </button>
          <button
            onClick={() => onTransformationUpdate(selectedFile.name, selectedAxis, 1 / conversionFactor)}
            className="px-2 py-1 bg-gray-300 rounded mr-2 cursor-pointer hover:bg-gray-400"
            title={`Move +1mm (${(1 / conversionFactor).toFixed(2)} file units)`}
          >
            +1mm
          </button>
          <button
            onClick={() => onTransformationUpdate(selectedFile.name, selectedAxis, 10 / conversionFactor)}
            className="px-2 py-1 bg-gray-300 rounded cursor-pointer hover:bg-gray-400"
            title={`Move +10mm (${(10 / conversionFactor).toFixed(2)} file units)`}
          >
            +10mm
          </button>
        </div>
      )}

      {/* Adjustment buttons for ROTATION */}
      {transformMode === 'rotation' && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => updateRotation(selectedAxis, -5)}
            className="px-2 py-1 bg-gray-300 rounded cursor-pointer hover:bg-gray-400"
            title="Rotate -5 degrees"
          >
            -5°
          </button>
          <button
            onClick={() => updateRotation(selectedAxis, -2)}
            className="px-2 py-1 bg-gray-300 rounded cursor-pointer hover:bg-gray-400"
            title="Rotate -2 degrees"
          >
            -2°
          </button>
          <button
            onClick={() => updateRotation(selectedAxis, -1)}
            className="px-2 py-1 bg-gray-300 rounded cursor-pointer hover:bg-gray-400"
            title="Rotate -1 degree"
          >
            -1°
          </button>
          <button
            onClick={() => updateRotation(selectedAxis, 1)}
            className="px-2 py-1 bg-gray-300 rounded cursor-pointer hover:bg-gray-400"
            title="Rotate +1 degree"
          >
            +1°
          </button>
          <button
            onClick={() => updateRotation(selectedAxis, 2)}
            className="px-2 py-1 bg-gray-300 rounded cursor-pointer hover:bg-gray-400"
            title="Rotate +2 degrees"
          >
            +2°
          </button>
          <button
            onClick={() => updateRotation(selectedAxis, 5)}
            className="px-2 py-1 bg-gray-300 rounded cursor-pointer hover:bg-gray-400"
            title="Rotate +5 degrees"
          >
            +5°
          </button>
        </div>
      )}

      {/* Current values table for POSITION */}
      {transformMode === 'position' && (
        <table className="table-auto border-collapse w-full text-left">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-1 border">Axis</th>
              <th className="px-2 py-1 border">STL Units</th>
              <th className="px-2 py-1 border">Millimeters</th>
            </tr>
          </thead>
          <tbody>
            {POSITION_AXES.map(axis => {
              const valueInSTLUnits = transformations[selectedFile.name]?.[axis] || 0;
              const valueInMM = valueInSTLUnits * conversionFactor;
              return (
                <tr key={axis}>
                  <td className="px-2 py-1 border">{AXIS_LABELS[axis]}</td>
                  <td className="px-2 py-1 border">{valueInSTLUnits.toFixed(2)}</td>
                  <td className="px-2 py-1 border">{valueInMM.toFixed(2)}mm</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Current values table for ROTATION */}
      {transformMode === 'rotation' && (
        <table className="table-auto border-collapse w-full text-left">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-1 border">Axis</th>
              <th className="px-2 py-1 border">Degrees</th>
              <th className="px-2 py-1 border">Radians</th>
            </tr>
          </thead>
          <tbody>
            {ROTATION_AXES.map(axis => {
              const valueInRadians = transformations[selectedFile.name]?.[axis] || 0;
              const valueInDegrees = radiansToDegrees(valueInRadians);
              return (
                <tr key={axis}>
                  <td className="px-2 py-1 border">{AXIS_LABELS[axis]}</td>
                  <td className="px-2 py-1 border">{valueInDegrees.toFixed(1)}°</td>
                  <td className="px-2 py-1 border">{valueInRadians.toFixed(3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

function STLUploader() {
  // Loaded files state
  const [loadedFiles, setLoadedFiles] = useState<STLFile[]>([]);

  // Currently selected file for manipulation
  const [selectedFile, setSelectedFile] = useState<STLFile | null>(null);

  // Transformations applied to each file (indexed by file name)
  const [modelTransformations, setModelTransformations] = useState<Record<string, ModelTransformations>>({});

  // Unit in which STL files were exported (default: millimeters)
  const [stlUnit, setStlUnit] = useState<MeasurementUnit>('mm');

  /**
   * Processes the upload of new STL files
   */
  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = Array.from(event.target.files || []);

    const newSTLFiles = uploadedFiles.map((file, index) => {
      // Calculate global index considering already loaded files
      const globalIndex = loadedFiles.length + index;

      return {
        name: file.name,
        url: URL.createObjectURL(file),
        visible: true, // New files are visible by default
        color: getColorByIndex(globalIndex), // Assign fixed color at upload time
      };
    });

    setLoadedFiles((previousFiles) => [...previousFiles, ...newSTLFiles]);
  }

  /**
   * Manages file selection/deselection
   * Clicking on the selected file deselects it
   */
  function handleFileSelection(file: STLFile) {
    setSelectedFile(currentSelection =>
      currentSelection === file ? null : file
    );
  }

  /**
   * Toggles 3D model visibility
   */
  function toggleFileVisibility(file: STLFile) {
    setLoadedFiles(previousFiles =>
      previousFiles.map(f =>
        f === file ? { ...f, visible: !f.visible } : f
      )
    );
  }

  /**
   * Updates transformations of a specific model
   * Values are incremental (added to current value)
   */
  function updateModelTransformation(
    fileName: string,
    axis: TransformationAxis,
    incrementValue: number
  ) {
    setModelTransformations(previousTransformations => ({
      ...previousTransformations,
      [fileName]: {
        ...previousTransformations[fileName],
        [axis]: (previousTransformations[fileName]?.[axis] || 0) + incrementValue
      }
    }));
  }

  return (
    <div className="flex p-5 gap-5 w-full min-h-screen bg-amber-50">
      {/* Side control panel */}
      <div className="flex-1 w-64 p-4 pb-5">
        {/* Upload button */}
        <div className="mb-4">
          <label
            htmlFor="file-upload"
            className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 inline-block"
          >
            Load STL Files
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".stl,.STL"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Loaded files list */}
        <FileList
          files={loadedFiles}
          onFileSelect={handleFileSelection}
          selectedFile={selectedFile}
          onToggleVisibility={toggleFileVisibility}
        />

        {/* Transformation panel (visible only when a file is selected) */}
        {selectedFile && (
          <TransformationPanel
            selectedFile={selectedFile}
            transformations={modelTransformations}
            onTransformationUpdate={updateModelTransformation}
            stlUnit={stlUnit}
            onUnitChange={setStlUnit}
          />
        )}
      </div>

      {/* 3D Viewport */}
      <div className="flex-3 p-4 border-4 border-gray-300 bg-dark min-h-[600px] h-auto">
        <div className="relative w-full h-full min-h-[550px]">
          <Canvas
            className="bg-gray-800 w-full h-full"
            camera={{ position: [0, 0, 10] }}
          >
            {/* Scene lighting */}
            <ambientLight intensity={1} />
            <pointLight position={[10, 10, 10]} />

            {/* Orbit controls (rotate, zoom, pan) */}
            <OrbitControls enablePan enableZoom enableRotate />

            {/* Container with all STL models */}
            <ModelsContainer
              files={loadedFiles}
              selectedFile={selectedFile}
              transformations={modelTransformations}
            />
          </Canvas>
        </div>
      </div>
    </div>
  );
}

export default STLUploader;