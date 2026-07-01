import { configureStore } from '@reduxjs/toolkit'
import analysisReducer from './analysisSlice'

const store = configureStore({
  reducer: {
    analysis: analysisReducer,
  },
})

export default store
