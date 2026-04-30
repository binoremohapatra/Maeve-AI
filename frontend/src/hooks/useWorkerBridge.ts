import { useEffect } from 'react';
import { workerSocketBridge } from '../services/workerSocketBridge';
import { useMoodStore } from '../stores/moodStore';

export const useWorkerBridge = () => {
    useEffect(() => {
        const onConnected = () => {
            console.log(' WebSocket Bridge: Connected to Worker');
            useMoodStore.setState({ isConnected: true });
        };

        const onDisconnected = () => {
            console.log(' WebSocket Bridge: Disconnected from Worker');
            useMoodStore.setState({ isConnected: false });
        };

        const onStreamStart = () => {
            useMoodStore.setState({ isStreaming: true, streamingText: '' });
        };

        const onTextToken = (data: { token: string }) => {
            useMoodStore.setState((state) => ({
                streamingText: state.streamingText + data.token
            }));
        };

        const onStreamEnd = () => {
            useMoodStore.setState({ isStreaming: false });
        };

        // Wire up listeners
        workerSocketBridge.on('CONNECTED', onConnected);
        workerSocketBridge.on('DISCONNECTED', onDisconnected);
        workerSocketBridge.on('STREAM_START', onStreamStart);
        workerSocketBridge.on('TEXT_TOKEN', onTextToken);
        workerSocketBridge.on('STREAM_END', onStreamEnd);

        // Initial sync
        useMoodStore.setState({ isConnected: workerSocketBridge.isConnected() });

        return () => {
            workerSocketBridge.off('CONNECTED', onConnected);
            workerSocketBridge.off('DISCONNECTED', onDisconnected);
            workerSocketBridge.off('STREAM_START', onStreamStart);
            workerSocketBridge.off('TEXT_TOKEN', onTextToken);
            workerSocketBridge.off('STREAM_END', onStreamEnd);
        };
    }, []);
};
