import { GluegunCommand, filesystem } from 'gluegun'
import * as ytdl from 'ytdl-core'
import * as figlet from 'figlet'
import * as fs from 'fs'
import * as path from 'path'
import * as progress from 'cli-progress'
import * as ffmpeg from 'fluent-ffmpeg';

// Testing link for Youtube
//
// https://youtu.be/I6X_MWHk7ds
// https://www.youtube.com/watch?v=I6X_MWHk7ds
// https://www.youtube.com/watch?v=O80jI2O0HeM&t=5s
//

const command: GluegunCommand = {
  name: 'youtube2audio',
  run: async toolbox => {
    const { print } = toolbox

    let packageJsonFilePath: string = null
    module.paths.map((uri: string) => {
      const testPackageJsonFilePath = path.resolve(uri, '../package.json')
      if (!packageJsonFilePath && fs.existsSync(testPackageJsonFilePath)) {
        packageJsonFilePath = testPackageJsonFilePath
      }
    })

    // Read app info from package.json
    const appConfig: any = JSON.parse(
      fs.readFileSync(packageJsonFilePath).toString()
    )
    const progressBar: any = new progress.SingleBar(
      {
        stopOnComplete: true,
        clearOnComplete: true,
        format: 'progress [{bar}] {percentage}%'
      },
      progress.Presets.shades_classic
    )
    // Print app logo
    const logo = figlet.textSync(appConfig.name)
    print.info(print.colors.rainbow(logo))

    const url: string = toolbox.parameters.first
    if (
      typeof url === 'string' &&
      /^https:\/\/www\.youtube\.com\/watch\?v=[a-z0-9_\-]+/i.test(url)
    ) {
      const urlInfo: RegExpMatchArray = url.match(
        /^https:\/\/www\.youtube\.com\/watch\?v=([a-z0-9_\-]+)$/i
      )

      const filename = urlInfo.length >= 2 ? `${urlInfo[1]}.mp3` : null
      const outFilePath = path.resolve(filesystem.cwd(), filename)
      const outFileStream = fs.createWriteStream(outFilePath)
      let audioInfo = null;
      const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' })
      // Show media info when ready
      stream.on(
        'info',
        (videoInfo: ytdl.videoInfo, videoFormat: ytdl.videoFormat) => {
          audioInfo = videoInfo
          print.info(`Audio: ${videoInfo.title}`)
          if (videoFormat.audioSampleRate) {
            print.info(
              `Sample rate: ${parseInt(videoFormat.audioSampleRate, 10) /
                1000} kHz`
            )
          }
          print.info(`Channel: ${videoFormat.audioChannels}\n`)
          print.info(`Fetching from ${videoInfo.video_url}..`)

          progressBar.start(100, 0)
        }
      )
      // Show download progress on changed
      stream.on(
        'progress',
        (chunk: number, downloadByte: number, totalByte: number): void => {
          const percentage = Math.floor(
            (downloadByte / (totalByte * 1.0)) * 100
          )
          // print.debug(`chunk: ${chunk}, downloadByte: ${downloadByte}, totalByte: ${totalByte}, percentage: ${percentage}`)
          progressBar.update(percentage)
        }
      )

      stream.on('end', () => {
        progressBar.stop()
        print.info('Done!')

        const optOutputFile = `${filesystem.cwd()}/${audioInfo.title}.mp3`

        ffmpeg(outFilePath)
          // .output(stream, { end: true})
          .on('start', () => {
            print.info('Optimizing the audio file..')
            progressBar.start(100, 0)
          })
          .on('progress', (progress) => {
            progressBar.update(Math.ceil(progress.percent))
          })
          .on('end', () => {
            // Delete the un-optimized file
            fs.unlink(outFilePath, () => {
              progressBar.stop();
              print.info('Done!')
              print.info(`Output to ${optOutputFile}\n`)
              process.exit()
            });
          })
          .save(optOutputFile)
      })

      stream.pipe(
        outFileStream,
        { end: true }
      )
    } else {
      // Url not pass or not a valid Youtube's url path
      print.error(
        "Not support this type of Youtube's url. It should be something like this `https://www.youtube.com/watch?v=..`."
      )
    }
  }
}

module.exports = command
