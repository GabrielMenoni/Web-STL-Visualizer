import { TbHexagon3D, TbEye, TbEyeOff } from "react-icons/tb";

// ==================== TYPES ====================

type STLFile = {
    name: string;
    url: string;
    visible?: boolean;
    color?: string;
};

interface FileListProps {
    files: STLFile[];
    onFileSelect: (file: STLFile) => void;
    selectedFile: STLFile | null;
    onToggleVisibility: (file: STLFile) => void;
}

// ==================== CONSTANTS ====================

const MAX_FILENAME_LENGTH = 33;
const TRUNCATE_AT = 30;

// ==================== UTILITIES ====================

/**
 * Truncates the file name if too long
 * Removes .stl extension and adds ellipsis if necessary
 */
function formatFileName(fileName: string): string {
    const baseFileName = fileName.replace(/\.stl$/i, '');

    if (baseFileName.length > MAX_FILENAME_LENGTH) {
        return `${baseFileName.substring(0, TRUNCATE_AT)}...`;
    }

    return baseFileName;
}

// ==================== COMPONENT ====================

/**
 * List of loaded STL files
 * Allows selection of individual files for manipulation and visibility control
 * 
 * @param files - Array of loaded STL files
 * @param onFileSelect - Callback executed when a file is selected
 * @param selectedFile - Currently selected file (if any)
 * @param onToggleVisibility - Callback to toggle model visibility
 */
export function FileList({ files, onFileSelect, selectedFile, onToggleVisibility }: FileListProps) {
    return (
        <ul className="list-none p-0 mb-4 overflow-y-auto max-h-80 w-fit">
            {files.map((file) => {
                const isSelected = file === selectedFile;
                const isVisible = file.visible !== false; // Padrão é visível

                return (
                    <li
                        key={file.url}
                        className={`mb-2 p-2 border border-gray-200 rounded w-full whitespace-nowrap flex items-center justify-between ${isSelected ? 'bg-blue-200' : 'bg-gray-100'
                            }`}
                        title={file.name} // Shows full name on hover
                    >
                        <div
                            className="flex items-center flex-1 cursor-pointer"
                            onClick={() => onFileSelect(file)}
                        >
                            <TbHexagon3D
                                className="inline-block mr-2 text-gray-500"
                                size={28}
                                aria-label="3D model icon"
                            />
                            <span className={!isVisible ? 'opacity-50' : ''}>
                                {formatFileName(file.name)}
                            </span>
                        </div>

                        {/* Visibility button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleVisibility(file);
                            }}
                            className="ml-2 p-1 hover:bg-gray-300 rounded cursor-pointer"
                            title={isVisible ? 'Hide model' : 'Show model'}
                        >
                            {isVisible ? (
                                <TbEye size={20} className="text-blue-600" />
                            ) : (
                                <TbEyeOff size={20} className="text-gray-400" />
                            )}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}