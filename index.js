import axios from "axios";
import { downloadAndSave, downloadAndSaveFiles, downloadSingleFile, downloadAll } from "./download.js";
// require('dotenv').config();



const fetchUsers = async ( next_page_token ) => {
    const conditionalUrl = next_page_token
        ? `http://localhost:8080/api/users?next_page_token=${ next_page_token }`
        : `http://localhost:8080/api/users`

    try {
        const response = await axios.get( conditionalUrl, {
            headers: {
                Accept: 'application/json'
            }
        })

        const data = response.data
        const users =  data.users || []

        // Check if there are more pages
        if ( data.next_page_token ) {
            const nextPageUsers = await fetchUsers( data.next_page_token )
            return [ ...users, ...nextPageUsers ]
        }
        return users
    } catch (error) {
        return null
    }
}

const fetchUserMeetings = async ( user_id, next_page_token, from, to ) => {
    const conditionalUrl = next_page_token
        ? `http://localhost:8080/api/users/${ user_id }/recordings?from=${ from }&to=${ to }&next_page_token=${ next_page_token }`
        : `http://localhost:8080/api/users/${ user_id }/recordings?from=${ from }&to=${ to }`

    try {
        const response = await axios.get( conditionalUrl, {
            headers: {
                Accept: 'application/json'
            }
        })

        const data = response.data
        const meetings = data.meetings

        if ( data.next_page_token ) {
            const nextPageRecordings = await fetchUserMeetings( user_id, data.next_page_token, from, to )
            // filter out meetings that don't have recordings
            const filtered = nextPageRecordings.filter(item => item.recording_files.length >= 1)
            // console.log([ ...meetings, ...filtered ])
            return [ ...meetings, ...filtered ]
        }
        const filteredMeetings = meetings.filter(item => item.recording_files.length >= 1)
        return filteredMeetings
    } catch (error) {
        return null
    }
}

const getAllUsersMeetings = async ( users, from, to ) => {

    if ( users && users.length >= 1 ) {
        try {
            const usersWithMeetings = await Promise.all(
                users.map( async (user) => {
                    const currentUserMeetings = await fetchUserMeetings( user.id, null, from, to )
                    if (currentUserMeetings && currentUserMeetings.length >= 1 ) {
                        return { ...user, meetings: currentUserMeetings }
                    } else {
                        return { ...user }
                    }
                } )
            )
            console.log(`Found ${ usersWithMeetings.length } users that have meetings.`)
            return usersWithMeetings
        } catch (error) {
            console.error( `Error fetch all users' meetings: `, error )
        }        
    }

}

const getMeetingRecordings = async ( meeting, startTime, ) => {

    const timeStamp = new Date(startTime)
    const year = timeStamp.getFullYear()
    const month = timeStamp.getMonth() + 1
    const day = timeStamp.getDate()

    try {
        console.log(`Adding the ${ meeting.topic } meeting's files to the download list...`)
        const response = await axios.get(`http://localhost:8080/api/recordings/${ meeting.id }`)

        if ( response && response.data && response.data.recording_files && response.data.recording_files.length > 0 ) {
            const recordings = response.data.recording_files
            const prepared = recordings.map((recording, index) => {
                return {
                    filePath: `meetings/${ year }/${ month }/${ day }/${ meeting.topic }/`,
                    url: `${ recording.download_url }`,
                    filename: `meetings/${ year }/${ month }/${ day }/${ meeting.topic }/${ recording.file_type }-${index}.${recording.file_extension}`,
                    // accessToken: token,
                }
            })
            return prepared
        } else {
            console.error(`Could not retrieve the meeting's recordings.`)
            return []
        }
        
    } catch (error) {
        console.error(`Error retrieving the meeting's recordings.`)
        return []
    }
}



const getRecordingsList = async ( onlyMeetings ) => {

    let allRecordingsFlat = []

    for await ( const user of onlyMeetings ) {
        //onlyMeetings.forEach((user) => {
            
        if ( user && user.meetings && user.meetings.length > 0 ) {

            for await ( const meeting of user.meetings ) {
                if ( meeting && meeting.start_time ) {
                    const prepared = await getMeetingRecordings(meeting, meeting.start_time)
                    allRecordingsFlat.push( prepared )
                }
            }
        }
    }

    const flattened = allRecordingsFlat.flat()
    return flattened

}


const main = async () => {

    const from = '2023-11-01'
    const to = '2023-11-20'

    try {

        console.log(`Getting users...`)
        const users = await fetchUsers()

        if ( users && users.length > 0 ) {
            console.log(`Found ${ users.length } users.`)
            console.log(`Getting users' meetings between ${ from } and ${ to }`)
            const allMeetings = await getAllUsersMeetings( users, from, to )

            if ( allMeetings && allMeetings.length > 0 ) {
                console.log(`Found a total of ${ allMeetings.length } meetings between all ${ users.length } users.`)
                // Filter out meetings that don't have recordings
                const onlyMeetings = allMeetings.filter(item => item.meetings && item.meetings.length >= 1)

                if ( onlyMeetings && onlyMeetings.length > 0 ) {
                    console.log(`Found ${ onlyMeetings.length } meetings that have a recording.`)                   

                    const recordingList = await getRecordingsList( onlyMeetings )
                    // console.log(JSON.stringify(recordingList, null, 1))

                    if (recordingList && recordingList.length > 0) {
                        console.log(`Found a total of ${ recordingList.length } recording files to be downloaded.`)
                        console.log(`Initiating files download...`)
                        // console.log(recordingList)
                        for await (const fileRow of recordingList) {
                            const { filePath, url, filename } = fileRow
                            console.log(`Getting download token...`)
                            const tokenResponse = await axios.get(`http://localhost:8080/api/token`)
                            const token = tokenResponse.data.Authorization
                            if (token) {
                                await downloadSingleFile( filePath, url, filename, token )
                            }
                        }
                        // downloadAll( recordingList ).then(() => {
                        //     console.log(`All recordings downloaded.`)
                        // }).catch(error => {
                        //     console.error(`Could not download all the recordings`, error)
                        // })
                    }                        
                    
                }
            }
        }
        


    } catch (error) {

        console.error(error)
        
    }    

}

main()
