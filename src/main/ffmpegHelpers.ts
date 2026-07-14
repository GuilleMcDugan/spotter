import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'

const resolvedFfmpegPath = (ffmpegPath as string).replace('app.asar', 'app.asar.unpacked')
ffmpeg.setFfmpegPath(resolvedFfmpegPath)

export interface VideoMetadata {
  duration: number
  width: number
  height: number
  fps: number
  hasAudio: boolean
  aspectRatio: string
}

export function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err)
        return
      }

      const videoStream = data.streams.find((s) => s.codec_type === 'video')
      const audioStream = data.streams.find((s) => s.codec_type === 'audio')

      const duration = data.format.duration || 0
      const width = videoStream?.width || 0
      const height = videoStream?.height || 0

      let fps = 25
      if (videoStream?.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/')
        const num = parseInt(parts[0])
        const den = parseInt(parts[1])
        if (den > 0) fps = Math.round(num / den)
      }

      const hasAudio = !!audioStream

      const ratio = width / height
      let aspectRatio = '16:9'
      if (ratio < 0.6) aspectRatio = '9:16'
      else if (ratio >= 0.6 && ratio < 0.85) aspectRatio = '4:3'
      else if (ratio >= 0.85 && ratio < 1.15) aspectRatio = '1:1'
      else if (ratio >= 1.15 && ratio < 1.5) aspectRatio = '4:3'
      else if (ratio >= 1.5 && ratio < 1.9) aspectRatio = '16:9'
      else if (ratio >= 1.9 && ratio < 2.2) aspectRatio = '21:9'
      else if (ratio >= 2.2) aspectRatio = '2.39:1'

      resolve({ duration, width, height, fps, hasAudio, aspectRatio })
    })
  })
}
