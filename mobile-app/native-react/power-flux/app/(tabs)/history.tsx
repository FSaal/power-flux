import { StyleSheet, Text, View } from 'react-native';

export default function AboutScreen() {
    return (
        <View style={styles.container} >
            <Text style={styles.text}> Placeholder. This page will contain the history of measurements. </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#25292e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#fff',
    },
});

