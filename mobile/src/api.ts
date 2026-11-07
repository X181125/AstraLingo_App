import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createApiClient } from './api-client';
export { ApiError } from './api-client';

const host = Constants.expoConfig?.hostUri?.split(':')[0];
const webHost = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : null;
const developmentUrl = `http://${webHost || host || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost')}:4000/api`;
export const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || (__DEV__ ? developmentUrl : Platform.OS === 'web' ? '/api' : '');
export const api = createApiClient(API_URL, !__DEV__ && Platform.OS !== 'web');
