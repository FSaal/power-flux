import DeleteConfirmation from '@/components/delete_confirmation';
import { dbService, ISession, SessionUpdate } from '@/shared/services/database';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const EXERCISE_TYPES = ['Bench Press', 'Deadlift', 'Squat', 'Shoulder Press', 'Other'] as const;

type ExerciseType = (typeof EXERCISE_TYPES)[number];

interface SessionDetailProps {
  session: ISession;
  onClose: () => void;
  onDelete: () => void;
  onExport: () => void;
  onUpdate: (updates: SessionUpdate) => void;
}

const SessionDetail: React.FC<SessionDetailProps> = ({
  session,
  onClose,
  onDelete,
  onExport,
  onUpdate,
}) => {
  const [exerciseType, setExerciseType] = useState<string>(session.exerciseType || '');
  const [comments, setComments] = useState<string>(session.comments || '');
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onUpdate({ exerciseType, comments });
    setIsEditing(false);
  };

  return (
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Session Details</Text>
        <TouchableOpacity onPress={onClose}>
          <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.detailsContainer}>
        <Text style={styles.detailLabel}>Date</Text>
        <Text style={styles.detailValue}>
          {new Date(session.startTime).toLocaleString('de-DE')}
        </Text>

        <Text style={styles.detailLabel}>Duration</Text>
        <Text style={styles.detailValue}>{formatDuration(session.startTime, session.endTime)}</Text>

        <Text style={styles.detailLabel}>Exercise Type</Text>
        {isEditing ? (
          <View style={styles.exerciseTypeContainer}>
            {EXERCISE_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.exerciseTypeButton,
                  exerciseType === type && styles.exerciseTypeButtonSelected,
                ]}
                onPress={() => setExerciseType(type)}
              >
                <Text
                  style={[
                    styles.exerciseTypeButtonText,
                    exerciseType === type && styles.exerciseTypeButtonTextSelected,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.detailValue}>{session.exerciseType || 'Not specified'}</Text>
        )}

        <Text style={styles.detailLabel}>Comments</Text>
        {isEditing ? (
          <TextInput
            style={styles.commentsInput}
            value={comments}
            onChangeText={setComments}
            placeholder="Add comments..."
            placeholderTextColor="#6B7280"
            multiline
          />
        ) : (
          <Text style={styles.detailValue}>{session.comments || 'No comments'}</Text>
        )}
      </View>

      <View style={styles.modalActions}>
        {isEditing ? (
          <TouchableOpacity style={[styles.actionButton, styles.saveButton]} onPress={handleSave}>
            <MaterialCommunityIcons name="content-save" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Save</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => setIsEditing(true)}
          >
            <MaterialCommunityIcons name="pencil" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.actionButton, styles.exportButton]} onPress={onExport}>
          <MaterialCommunityIcons name="export" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Export</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={onDelete}>
          <MaterialCommunityIcons name="delete" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const formatDuration = (startTime: number, endTime: number | null) => {
  if (!endTime) return 'In progress';
  const duration = endTime - startTime;
  const seconds = Math.floor((duration / 1000) % 60);
  const minutes = Math.floor((duration / (1000 * 60)) % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ISession | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ISession | null>(null);

  const loadSessions = async () => {
    try {
      const loadedSessions = await dbService.getSessions();
      setSessions(loadedSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
      Alert.alert('Error', 'Failed to load sessions');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadSessions();
  }, []);

  const handleUpdateSession = async (sessionId: string, updates: SessionUpdate) => {
    try {
      await dbService.updateSession(sessionId, updates);
      await loadSessions();
      console.log('Session updated successfully');
    } catch (error) {
      console.error('Error updating session:', error);
      Alert.alert('Error', 'Failed to update session');
    }
  };

  const handleDeleteSession = async (session: ISession) => {
    setSessionToDelete(session);
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;

    try {
      await dbService.deleteSession(sessionToDelete.id);
      await loadSessions();
      setSelectedSession(null);
      setShowDeleteConfirmation(false);
      setSessionToDelete(null);
    } catch (error) {
      console.error('Error deleting session:', error);
      Alert.alert('Error', 'Failed to delete session');
    }
  };

  const handleExportSession = async (session: ISession) => {
    try {
      console.log('Starting export for session:', session.id);
      const sessionData = await dbService.exportSessionToJSON(session.id);
      console.log('JSON generated, string length:', sessionData.length);

      const filePath = `${FileSystem.documentDirectory}session_${session.id}.json`;
      console.log('Writing to file:', filePath);
      await FileSystem.writeAsStringAsync(filePath, sessionData);
      console.log('File written successfully');

      if (await Sharing.isAvailableAsync()) {
        console.log('Sharing file...');
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/json',
          dialogTitle: 'Export Session Data',
          UTI: 'public.json',
        });
        console.log('File shared successfully');
      }
    } catch (error) {
      console.error('Error in handleExportSession:', error);
      Alert.alert('Error', 'Failed to export session');
    }
  };

  const renderSessionItem = ({ item }: { item: ISession }) => (
    <TouchableOpacity style={styles.sessionItem} onPress={() => setSelectedSession(item)}>
      <View style={styles.sessionHeader}>
        <View>
          <Text style={styles.sessionDate}>{new Date(item.startTime).toLocaleString('de-DE')}</Text>
          {item.exerciseType && <Text style={styles.exerciseType}>{item.exerciseType}</Text>}
        </View>
        <Text style={styles.sessionDuration}>{formatDuration(item.startTime, item.endTime)}</Text>
      </View>
      {item.comments && (
        <Text style={styles.comments} numberOfLines={1}>
          {item.comments}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        renderItem={renderSessionItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recorded sessions yet</Text>
          </View>
        }
      />

      <Modal
        visible={selectedSession !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedSession(null)}
      >
        {selectedSession && (
          <View style={styles.modalOverlay}>
            <SessionDetail
              session={selectedSession}
              onClose={() => setSelectedSession(null)}
              onDelete={() => handleDeleteSession(selectedSession)}
              onExport={() => handleExportSession(selectedSession)}
              onUpdate={(updates) => {
                handleUpdateSession(selectedSession.id, updates);
              }}
            />
          </View>
        )}
        <DeleteConfirmation
          isVisible={showDeleteConfirmation}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteConfirmation(false)}
          message="This action cannot be undone. All session data will be permanently deleted."
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  sessionItem: {
    backgroundColor: '#1F2937',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionDate: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  sessionDuration: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  sessionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  iconButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: '40%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  detailsContainer: {
    marginBottom: 20,
  },
  detailLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 4,
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  exportButton: {
    backgroundColor: '#22C55E',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  exerciseType: {
    color: '#22C55E',
    fontSize: 14,
    marginTop: 4,
  },
  comments: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  exerciseTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  exerciseTypeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: 'transparent',
  },
  exerciseTypeButtonSelected: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  exerciseTypeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  exerciseTypeButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  commentsInput: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 8,
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: '#6366F1',
  },
  saveButton: {
    backgroundColor: '#22C55E',
  },
});
