// copied and modified from https://github.com/elysiajs/elysia-static/blob/main/src/index.ts
import { Elysia, NotFoundError } from 'elysia'

import { generateETag, isCached } from './cache'
import mime from 'mime'

type VfsMap = Record<string, string>

// Generate ETag from buffer
async function generateETagFromBuffer(buffer: Buffer): Promise<string> {
    const hash = new Bun.CryptoHasher('md5')
    hash.update(buffer)
    return hash.digest('base64')
}

const URL_PATH_SEP = '/'

// Get file content from VFS as Buffer
const getVfsFile = (vfs: VfsMap, path: string): Buffer | null => {
    const base64Content = vfs[path]
    if (!base64Content) return null
    return Buffer.from(base64Content, 'base64')
}

// List all files in VFS
const listVfsFiles = (vfs: VfsMap): string[] => {
    return Object.keys(vfs)
}

export const staticPlugin = async <Prefix extends string = '/prefix'>(
    {
        vfs,
        prefix = '/public' as Prefix,
        ignorePatterns = ['.DS_Store', '.git', '.env'],
        noExtension = false,
        enableDecodeURI = false,
        headers = {},
        noCache = false,
        maxAge = 86400,
        directive = 'public',
        indexHTML = true
    }: {
        /**
         * VFS map containing file paths to base64-encoded content
         */
        vfs: VfsMap
        /**
         * @default '/public'
         *
         * Path prefix to create virtual mount path for the static directory
         */
        prefix?: Prefix
        /**
         * @default [] `Array<string | RegExp>`
         *
         * Array of file to ignore publication.
         * If one of the patters is matched,
         * file will not be exposed.
         */
        ignorePatterns?: Array<string | RegExp>
        /**
         * Indicate if file extension is required
         *
         * Only works if `alwaysStatic` is set to true
         */
        noExtension?: boolean
        /**
         *
         * When url needs to be decoded
         *
         * Only works if `alwaysStatic` is set to false
         */
        enableDecodeURI?: boolean
        /**
         * Set headers
         */
        headers?: Record<string, string> | undefined
        /**
         * @default false
         *
         * If set to true, browser caching will be disabled
         */
        noCache?: boolean
        /**
         * @default public
         *
         * directive for Cache-Control header
         *
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#directives
         */
        directive?:
        | 'public'
        | 'private'
        | 'must-revalidate'
        | 'no-cache'
        | 'no-store'
        | 'no-transform'
        | 'proxy-revalidate'
        | 'immutable'
        /**
         * @default 86400
         *
         * Specifies the maximum amount of time in seconds, a resource will be considered fresh.
         * This freshness lifetime is calculated relative to the time of the request.
         * This setting helps control browser caching behavior.
         * A `maxAge` of 0 will prevent caching, requiring requests to validate with the server before use.
         */
        maxAge?: number | null
        /**
         * @default true
         *
         * Enable serving of index.html as default / route
         */
        indexHTML?: boolean
    }
) => {
    const files = listVfsFiles(vfs)

    if (prefix === URL_PATH_SEP) prefix = '' as Prefix

    const shouldIgnore = (file: string) => {
        if (!ignorePatterns.length) return false

        return ignorePatterns.find((pattern) => {
            if (typeof pattern === 'string') return pattern.includes(file)
            else return pattern.test(file)
        })
    }

    const app = new Elysia({
        name: 'static',
        seed: {
            vfs,
            prefix,
            ignorePatterns,
            noExtension,
            enableDecodeURI,
            headers,
            noCache,
            maxAge,
            directive,
            indexHTML
        }
    })

    // console.log('Static plugin: Files:', files)


    for (const relativePath of files) {
        if (!relativePath || shouldIgnore(relativePath)) continue

        let pathName = relativePath
        if (noExtension) {
            const temp = pathName.split('.')
            temp.splice(-1)
            pathName = temp.join('.')
        }

        pathName = prefix + (pathName.startsWith('/') ? '' : '/') + pathName

        // console.log('Static route: Path name:', pathName)

        const fileBuffer = getVfsFile(vfs, relativePath)
        if (!fileBuffer) {
            console.log('Static route: File not found in VFS:', relativePath)
            continue
        }

        const m = mime.getType(relativePath)

        // console.log('Static route: File found in VFS:', relativePath, "with content type:", m)

        const etag = await generateETagFromBuffer(fileBuffer)

        const responseBody = new Uint8Array(fileBuffer)

        app.get(
            pathName,
            noCache
                ? new Response(responseBody, {
                    headers: {
                        ...headers,
                        'Content-Type': m ?? 'application/octet-stream'
                    }
                })
                : async ({ headers: reqHeaders }) => {
                    if (await isCached(reqHeaders, etag, relativePath)) {
                        return new Response(null, {
                            status: 304,
                            headers: {
                                ...headers,
                                'Content-Type': m ?? 'application/octet-stream'
                            }
                        })
                    }

                    headers['Etag'] = etag
                    headers['Cache-Control'] = directive
                    if (maxAge !== null)
                        headers['Cache-Control'] += `, max-age=${maxAge}`

                    return new Response(responseBody, {
                        headers: {
                            ...headers,
                            'Content-Type': m ?? 'application/octet-stream'
                        }
                    })
                }
        )

        if (indexHTML && pathName.endsWith('/index.html'))
            app.get(
                pathName.replace('/index.html', ''),
                noCache
                    ? new Response(responseBody, {
                        headers: {
                            ...headers,
                            'Content-Type': m ?? 'application/octet-stream'
                        }
                    })
                    : async ({ headers: reqHeaders }) => {
                        if (await isCached(reqHeaders, etag, pathName)) {
                            return new Response(null, {
                                status: 304,
                                headers: {
                                    ...headers,
                                    'Content-Type': m ?? 'application/octet-stream'
                                }
                            })
                        }

                        headers['Etag'] = etag
                        headers['Cache-Control'] = directive
                        if (maxAge !== null)
                            headers['Cache-Control'] +=
                                `, max-age=${maxAge}`

                        return new Response(responseBody, {
                            headers: {
                                ...headers,
                                'Content-Type': m ?? 'application/octet-stream'
                            }
                        })
                    }
            )
    }


    return app
}

export default staticPlugin