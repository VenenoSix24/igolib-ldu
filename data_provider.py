# data_provider.py
"""
动态数据提供者模块

通过 GraphQL API 获取实时场馆和座位信息。
采用两阶段策略：先获取场馆列表，再按需获取特定场馆的座位分布。
"""
import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from config import (
    URL, pre_header_base,
    data_rooms_list_template, data_seats_layout_template
)

logger = logging.getLogger(__name__)


class LibraryDataProvider:
    """
    图书馆动态数据提供者
    
    负责通过 GraphQL API 获取实时场馆和座位信息。
    所有方法均为异步，需在 async 上下文中调用。
    """
    
    def __init__(self, cookie_string: str):
        """
        初始化数据提供者
        
        Args:
            cookie_string: 用户的登录 Cookie（包含 JWT）
        """
        self.url = URL
        self.cookie = cookie_string
        self._client: Optional[httpx.AsyncClient] = None
    
    def _get_headers(self) -> Dict[str, str]:
        """构建请求头"""
        headers = pre_header_base.copy()
        # 确保 Cookie 是 latin-1 兼容的
        try:
            safe_cookie = self.cookie.encode('latin-1').decode('latin-1')
        except UnicodeEncodeError:
            safe_cookie = self.cookie
        headers['Cookie'] = safe_cookie
        return headers
    
    async def _post_graphql(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        发送 GraphQL 请求
        
        Args:
            payload: GraphQL 请求体（包含 operationName, query, variables）
            
        Returns:
            API 响应的 JSON 数据，失败时返回 None
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.url,
                    headers=self._get_headers(),
                    json=payload
                )
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException:
            logger.error("GraphQL 请求超时")
            return None
        except httpx.HTTPStatusError as e:
            logger.error(f"GraphQL 请求失败: HTTP {e.response.status_code}")
            return None
        except Exception as e:
            logger.error(f"GraphQL 请求发生错误: {e}")
            return None
    
    async def fetch_all_rooms(self) -> List[Dict[str, Any]]:
        """
        阶段一：获取所有场馆的基础信息
        
        Returns:
            场馆列表，每个元素包含：
            - id: 场馆 ID
            - name: 场馆名称
            - floor: 楼层
            - isOpen: 是否开放
            - seatsTotal: 总座位数
            - seatsUsed: 已使用座位数
            - seatsAvailable: 剩余座位数
            - openTime: 开放时间
            - closeTime: 关闭时间
        """
        payload = json.loads(json.dumps(data_rooms_list_template))
        data = await self._post_graphql(payload)
        
        results: List[Dict[str, Any]] = []
        if not data:
            return results
        
        # 检查是否有错误
        if 'errors' in data:
            error_msg = data['errors'][0].get('msg', str(data['errors']))
            logger.error(f"获取场馆列表失败: {error_msg}")
            return results
        
        try:
            libs = (data.get('data', {})
                       .get('userAuth', {})
                       .get('reserve', {})
                       .get('libs', []))
            
            for lib in libs:
                lib_rt = lib.get('lib_rt', {}) or {}
                room = {
                    'id': lib.get('lib_id'),
                    'name': lib.get('lib_name', ''),
                    'floor': lib.get('lib_floor', ''),
                    'isOpen': lib.get('is_open', False),
                    'seatsTotal': lib_rt.get('seats_total', 0),
                    'seatsUsed': lib_rt.get('seats_used', 0),
                    'seatsAvailable': lib_rt.get('seats_has', 0),
                    'openTime': lib_rt.get('open_time_str', '').strip(),
                    'closeTime': lib_rt.get('close_time_str', '').strip(),
                }
                results.append(room)
            
            logger.info(f"成功获取 {len(results)} 个场馆信息")
        except Exception as e:
            logger.error(f"解析场馆列表响应失败: {e}")
        
        return results
    
    async def fetch_seats_for_room(self, room_id: int) -> Dict[str, Any]:
        """
        阶段二：获取指定场馆的座位布局
        
        Args:
            room_id: 场馆 ID
            
        Returns:
            座位信息字典：
            - roomId: 场馆 ID
            - roomName: 场馆名称
            - seats: 座位列表，每个座位包含 key, name, status, available
            - seatMapping: 座位号到坐标的映射 {name: key}
        """
        payload = json.loads(json.dumps(data_seats_layout_template))
        payload['variables']['libId'] = room_id
        
        data = await self._post_graphql(payload)
        
        result: Dict[str, Any] = {
            'roomId': room_id,
            'roomName': '',
            'seats': [],
            'seatMapping': {}
        }
        
        if not data:
            return result
        
        # 检查是否有错误
        if 'errors' in data:
            error_msg = data['errors'][0].get('msg', str(data['errors']))
            logger.error(f"获取场馆 {room_id} 座位布局失败: {error_msg}")
            return result
        
        try:
            libs = (data.get('data', {})
                        .get('userAuth', {})
                        .get('reserve', {})
                        .get('libs', []))
            
            if not libs:
                logger.warning(f"场馆 {room_id} 未返回数据")
                return result
            
            lib = libs[0]
            result['roomName'] = lib.get('lib_name', '')
            
            layout = lib.get('lib_layout', {}) or {}
            seats_data = layout.get('seats', []) or []
            
            seat_mapping: Dict[str, str] = {}
            seats_list: List[Dict[str, Any]] = []
            
            for seat in seats_data:
                key = seat.get('key', '')
                name = seat.get('name', '')
                
                # 只保留有 key 和 name 的座位（过滤掉空元素）
                if not key or not name:
                    continue
                
                # seat_status 判断座位是否可见/可选：
                # seat_status = 1 → 座位可见，可以在选座界面看到
                # seat_status = 0 → 座位隐藏/不存在
                # status 字段目前含义不明确，暂不用于判断
                seat_status = seat.get('seat_status', 1)  # 默认可见
                is_visible = (seat_status == 1)
                
                # 只保留可见的座位
                if not is_visible:
                    continue
                
                seats_list.append({
                    'key': key,
                    'name': name,
                    'status': seat_status,
                    'available': True  # 可见的座位都是可选的
                })
                
                # 构建座位映射：座位号 -> 坐标 key
                seat_mapping[name] = key
            
            result['seats'] = seats_list
            result['seatMapping'] = seat_mapping
            
            available_count = sum(1 for s in seats_list if s['available'])
            logger.info(f"场馆 {room_id} ({result['roomName']}) 获取到 {len(seats_list)} 个座位，其中 {available_count} 个可用")
            
        except Exception as e:
            logger.error(f"解析座位布局响应失败: {e}")
        
        return result
    
    async def validate_cookie(self) -> bool:
        """
        验证 Cookie 是否有效
        
        通过尝试获取场馆列表来验证 Cookie 的有效性。
        
        Returns:
            True 表示 Cookie 有效，False 表示无效或已过期
        """
        rooms = await self.fetch_all_rooms()
        return len(rooms) > 0
