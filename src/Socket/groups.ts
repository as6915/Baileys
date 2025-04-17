import { proto, WAMessage, WAMessageContent } from '../BaileysMultiAuth'
import makeWASocket, { BinaryNode, BinaryNodeAttributes, getBinaryNodeChildren, getBinaryNodeChild, getBinaryNodeChildString, jidNormalizedUser, WABusEventEmitter } from '../BaileysMultiAuth'
import { BinaryNodeWriter, S_WHATSAPP_NET } from '../BaileysMultiAuth/WAProto'
import NodeCache from 'node-cache'

const groupCache = new NodeCache()

export const makeGroupsSocket = (ev: WABusEventEmitter) => {
	const groupQuery = async (jid: string, type: string, content: BinaryNode[]) => {
		const result = await ev.query({
			tag: 'iq',
			attrs: {
				to: S_WHATSAPP_NET,
				type,
				xmlns: 'w:g2',
			},
			content: [{ tag: 'query', attrs: { jid }, content }],
		})
		return result
	}

	const groupMetadata = async (jid: string) => {
		if (groupCache.has(jid)) {
			return groupCache.get(jid)
		}
		const result = await groupQuery(
			jid,
			'get',
			[{ tag: 'query', attrs: { request: 'interactive' } }]
		)
		const metadata = extractGroupMetadata(result)
		groupCache.set(jid, metadata)
		return metadata
	}

	const extractGroupMetadata = (result: BinaryNode) => {
		const metaNode = getBinaryNodeChild(result, 'query')!
		const id = getBinaryNodeChildString(metaNode, 'id')!
		const owner = getBinaryNodeChildString(metaNode, 'owner')!
		const subject = getBinaryNodeChildString(metaNode, 'subject')!
		const subjectOwner = getBinaryNodeChildString(metaNode, 's_o')!
		const subjectTime = +getBinaryNodeChildString(metaNode, 's_t')!
		const creation = +getBinaryNodeChildString(metaNode, 'creation')!
		const desc = getBinaryNodeChildString(metaNode, 'desc') || ''
		const descId = getBinaryNodeChildString(metaNode, 'desc_id') || ''
		const descOwner = getBinaryNodeChildString(metaNode, 'desc_owner') || ''
		const descTime = +getBinaryNodeChildString(metaNode, 'desc_time')!
		const ephemeral = +getBinaryNodeChildString(metaNode, 'ephemeral')!
		const participants = getBinaryNodeChildren(metaNode, 'participant').map(item => ({
			id: item.attrs.jid,
			isAdmin: item.attrs.type === 'admin' || item.attrs.type === 'superadmin',
			isSuperAdmin: item.attrs.type === 'superadmin',
		}))

		return {
			id,
			owner,
			subject,
			subjectOwner,
			subjectTime,
			creation,
			desc,
			descId,
			descOwner,
			descTime,
			ephemeral,
			participants,
		}
	}

	ev.on('groups.update', async (updates) => {
		for (const update of updates) {
			const metadata = await groupMetadata(update.id)
			groupCache.set(update.id, metadata)
		}
	})

	return {
		groupMetadata
	}
}
