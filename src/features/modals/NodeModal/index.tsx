import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Group, Textarea } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import toast from "react-hot-toast";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useFile from "../../../store/useFile";
import useJson from "../../../store/useJson";
import { updateJsonAtPath } from "../../../lib/utils/helpers";
import { contentToJson } from "../../../lib/utils/jsonAdapter";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

//Get the actual value at the path from the JSON
const getValueAtPath = (json: any, path?: NodeData["path"]): any => {
  if (!path || path.length === 0) return json;
  let current = json;
  for (const segment of path) {
    if (current === undefined || current === null) return undefined;
    current = current[segment];
  }
  return current;
};

//then return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const getJson = useJson(state => state.getJson);
  const setContents = useFile(state => state.setContents);
  const getContents = useFile(state => state.getContents);
  const getFormat = useFile(state => state.getFormat);

  const [isEditing, setIsEditing] = React.useState(false);
  const [editedValue, setEditedValue] = React.useState("");
  // Local display value so modal can show the most-recent value immediately
  const [displayValueState, setDisplayValueState] = React.useState("");

  // Initialize edited value when node data changes or modal opens
  React.useEffect(() => {
    if (opened && nodeData) {
      try {
        const json = JSON.parse(getJson());
        const valueAtPath = getValueAtPath(json, nodeData.path);
        if (valueAtPath !== undefined) {
          // Format the value nicely for editing
          if (typeof valueAtPath === "object" && valueAtPath !== null) {
            setEditedValue(JSON.stringify(valueAtPath, null, 2));
            setDisplayValueState(JSON.stringify(valueAtPath, null, 2));
          } else {
            setEditedValue(String(valueAtPath));
            setDisplayValueState(String(valueAtPath));
          }
        } else {
          // Fallback to normalized node data
          setEditedValue(normalizeNodeData(nodeData.text));
          setDisplayValueState(normalizeNodeData(nodeData.text));
        }
      } catch (error) {
        // Fallback to normalized node data
        setEditedValue(normalizeNodeData(nodeData.text));
        setDisplayValueState(normalizeNodeData(nodeData.text));
      }
      setIsEditing(false);
    }
  }, [opened, nodeData, getJson]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to original value
    if (nodeData) {
      try {
        const json = JSON.parse(getJson());
        const valueAtPath = getValueAtPath(json, nodeData.path);
        if (valueAtPath !== undefined) {
          if (typeof valueAtPath === "object" && valueAtPath !== null) {
            setEditedValue(JSON.stringify(valueAtPath, null, 2));
          } else {
            setEditedValue(String(valueAtPath));
          }
        } else {
          setEditedValue(normalizeNodeData(nodeData.text));
        }
      } catch (error) {
        setEditedValue(normalizeNodeData(nodeData.text));
      }
    }
  };

  const handleSave = async () => {
    if (!nodeData || nodeData.path === undefined) {
      toast.error("Cannot save: Invalid node path");
      return;
    }

    try {
      // Parse the edited value
      let newValue: any;
      try {
        // Try to parse as JSON first
        newValue = JSON.parse(editedValue);
      } catch {
        // If not valid JSON, try to infer the type
        const trimmed = editedValue.trim();
        if (trimmed === "true") newValue = true;
        else if (trimmed === "false") newValue = false;
        else if (trimmed === "null") newValue = null;
        else if (!isNaN(Number(trimmed)) && trimmed !== "") {
          newValue = Number(trimmed);
        } else {
          newValue = editedValue;
        }
      }

      // Get current JSON content
      const currentContents = getContents();
      const format = getFormat();
      const currentJson = await contentToJson(currentContents, format);

      // Update the value at the path
      const updatedJson = updateJsonAtPath(currentJson, nodeData.path, newValue);

      // Convert back to string and update
      const updatedContents = JSON.stringify(updatedJson, null, 2);
      await setContents({ contents: updatedContents, hasChanges: true, skipUpdate: false });

      // Update local display state so the modal shows the newest value immediately
      try {
        const newValueAtPath = getValueAtPath(updatedJson, nodeData.path);
        if (newValueAtPath !== undefined) {
          if (typeof newValueAtPath === "object" && newValueAtPath !== null) {
            setDisplayValueState(JSON.stringify(newValueAtPath, null, 2));
          } else {
            setDisplayValueState(String(newValueAtPath));
          }
        } else {
          setDisplayValueState(normalizeNodeData(nodeData.text));
        }
      } catch (e) {
        setDisplayValueState(normalizeNodeData(nodeData.text));
      }

      setIsEditing(false);
      toast.success("Node updated successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save changes";
      toast.error(errorMessage);
    }
  };

  // Prefer local display state (keeps modal in-sync immediately after save),
  // fall back to nodeData-derived normalized text.
  const displayValue = displayValueState || normalizeNodeData(nodeData?.text ?? []);

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <CloseButton onClick={onClose} />
          </Flex>
          {isEditing ? (
            <Textarea
              value={editedValue}
              onChange={(e) => setEditedValue(e.target.value)}
              minRows={4}
              maxRows={10}
              autosize
              styles={{
                input: {
                  fontFamily: "monospace",
                  fontSize: "12px",
                },
              }}
            />
          ) : (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={displayValue}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          )}
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
        <Group justify="flex-end" mt="sm">
          {!isEditing ? (
            <Button onClick={handleEdit} size="sm">
              Edit
            </Button>
          ) : (
            <Group gap="xs">
              <Button onClick={handleCancel} size="sm" variant="default">
                Cancel
              </Button>
              <Button onClick={handleSave} size="sm">
                Save
              </Button>
            </Group>
          )}
        </Group>
      </Stack>
    </Modal>
  );
};
